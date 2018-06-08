/*
 * Immediately after powerup, the PPU isn't necessarily in a usable state.
 *
 * The transfer takes 512 CPU clock cycles, two cycles per byte, the transfer starts about immediately after writing to 4014h: The CPU either fetches the first byte of the next instruction, and then begins DMA, or fetches and executes the next instruction, and then begins DMA. The CPU is halted during transfer
 *
 * behaves as an 8-bit dynamic latch due to capacitance of very long traces that run to various parts of the PPU
 * reading a nominally "write-only" register returns the latch's current value
 */

//import {PPUMEM} from './memory.js';
//import colorTable from './palette.js';
//import newReg from './PPUregister.js';
//import Screen from './screen.js';

const PPU = function(colorTable, newReg, Screen, CPU) {
  /*** Counter ***/
  let Scanline; //int
  let Cycle; // int
  let Frame; //int

  let LATCH;

  /*** Exposed Register ***/
  // PPUCTRL
  let flagNameTable;
  let flagIncrement;
  let flagSpriteTable;
  let flagBackgroundTable;
  let flagSpriteSize;
  let flagMasterSlave;
  let nmiOutput;

  // PPUMASK
  let flagGrayscale;
  let flagShowLeftBackground;
  let flagShowLeftSprites;
  let flagShowBackground;
  let flagShowSprites;
  let flagRedTint;
  let flagGreenTint;
  let flagBlueTint;

  // PPUSTATUS
  let flagSpriteOverflow;
  let flagSpriteZeroHit;

  // OAMADDR
  let oamAddr;

  /*** Inside Register ***/
  let v = newReg();
  let t = newReg(); //16-bit
  let w = newReg(); //1-bit
  let x = newReg(); //3-bit
  let f = newReg(); //1-bit

  /*** NMI flags ***/
  let nmiOccurred; //boolean
  //let nmiOutput; //boolean
  let nmiPrevious; //boolean
  let nmiDelay; //8-bit

  /*** Background Temporary Variables ***/
  let nameTableByte; //8-bit
  let attributeTableByte; //8-bit
  let lowTileByte; //8-bit
  let highTileByte; //8-bit
  let tileData; //64-bit

  /*** Sprite Temporary Variables ***/
  let spriteCount = 0; //int
  let spritePatterns = new Array(8); //Array(8)32-bit
  let spritePositions = new Array(8); //Array(8)8-bit
  let spritePriorities = new Array(8); //Array(8)8-bit
  let spriteIndexes = new Array(8); //Array(8)8-bit

  const OAM = new Array(256);
  const PaletteData = new Array(32);
  const nameTableData = new Array(2048);

  /*** PPU basic operation ***/
  function Read(addr) {
    return PPU.MEM.read(addr);
  }

  function Write(addr) {
    PPU.MEM.write(addr);
  }

  function Reset() {
    Cycle = 340;
    Scanline = 240;
    Frame = 0;
    writeControl(0);
    writeMask(0);
    writeOAMAddr(0);
  }

  function readRegister(addr) {
    switch(addr) {
      case 0x2002:
        return readStatus();
      case 0x2004:
        return readOAMData();
      case 0x2007:
        return readData();
    }
    return 0;
  }

  function writeRegister(addr, value) {
    switch(addr) {
      case 0x2000:
        writeControl(value); break;
      case 0x2001:
        writeMask(value); break;
      case 0x2003:
        writeOAMAddr(value); break;
      case 0x2004:
        writeOAMData(value); break;
      case 0x2005:
        writeScroll(value); break;
      case 0x2006:
        writeAddr(value); break;
      case 0x2007:
        writeData(value); break;
      case 0x4014:
        writeDMA(value); break;
    }
  }

  function readPalette(addr) {
    return PaletteData[addr % 32];
  }

  function writePalette(addr, value) {
    PaletteData[addr % 32] = value;
  }

  function readRealColor(addr) {
    return colorTable[readPalette(addr)];
  }

  // $2000
  function writeControl(value) {
    flagNameTable = (value >> 0) & 0x3;
    flagIncrement = (value >> 2) & 1;
    flagSpriteTable = (value >> 3) & 1;
    flagBackgroundTable = (value >> 4) & 1;
    flagSpriteSize = (value >> 5) & 1;
    flagMasterSlave = (value >> 6) & 1;
    nmiOutput = (value >> 7) & 1 === 1;
    nmiChange();
    t.setBits(10, 2, value & 0x03);
  }

  // $2001
  function writeMask(value) {
    flagGrayscale = (value >> 0) & 1;
    flagShowLeftBackground = (value >> 1) & 1;
    flagShowLeftSprites = (value >> 2) & 1;
    flagShowBackground = (value >> 3) & 1;
    flagShowSprites = (value >> 4) & 1;
    flagRedTint = (value >> 5) & 1;
    flagGreenTint = (value >> 6) & 1;
    flagBlueTint = (value >> 7) & 1;
  }

  // $2002
  function readStatus() {
    let result = LATCH & 0x1F;
    result |= flagSpriteOverflow << 5;
    result |= flagSpriteZeroHit << 6;
    if (nmiOccurred) {
      result |= 1 << 7;
    }
    nmiOccurred = false;
    nmiChange();
    w.write(0);

    return result;
  }

  // $2003
  function writeOAMAddr(value) {
    oamAddr = value;
  }

  // $2004(read)
  function readOAMData() {
    return OAM[oamAddr];
  }

  // $2004(write)
  function writeOAMData(value) {
    OAM[oamAddr] = value;
    oamAddr++;
  }

  // $2005
  function writeScroll(value)  {
    if (w.read() === 0) {
      t.setBits(0, 5, value >> 3);
      x.write(value & 0x07);
      w.write(1);
    } else {
      t.setBits(5, 5, (value & 0xF8) >> 3);
      t.setBits(12, 3, value & 0x07);
      w.write(0);
    }
  }

  // $2006
  function writeAddr(value) {
    if (w.read() === 0) {
      t.setBits(8, 6, value & 0x3F);
      w.write(1);
    } else {
      t.setBits(0, 8, value);
      v.write(t.read());
      w.write(0);
    }
  }
  // $2007(read)
  function readData() {
    let value = Read(v.read());
    // buffered reads
    if (flagIncrement) {
      v.add(32);
    } else {
      v.inc();
    }
    return value;
  }
  // $2007(write)
  function writeData(value) {
    Write(v.read(), value);
    if (flagIncrement) {
      v.add(32);
    } else {
      v.inc();
    }
  }

  // $4014
  function wirteDMA(value) {
    let addr = value << 8;
    for (let i = 0; i < 256; i++) {
      OAM[oamAddr] = CPU.MEM.read(addr);
      oamAddr++;
      addr++;
    }

    return 513;
  }

  function incX() {
    if (v.read() & 0x001F === 31) {
      // coarse X = 0
      v.setBits(0, 5, 0);
      v.write(v.read() ^ 0x0400);
    } else {
      v.inc();
    }
  }

  function incY() {
    if (v.read() & 0x7000 != 0x7000) {
      v.add(0x1000);
    } else {
      // fine Y = 0;
      v.setBits(12, 3, 0);
      let y = v.readBits(5, 5);
      if (y === 29) {
        y = 0;
        v.write(v.read() ^ 0x0800);
      } else if (y === 31) {
        y = 0;
      } else {
        y++;
      }
      v.setBits(5, 5, y);
    }
  }

  function copyX() {
    v.setBits(0, 5, t.readBits(0, 5));
    v.setBit(10, t.readBit(10));
  }

  function copyY() {
    v.setBits(5, 5, t.readBits(5, 5));
    v.setBits(11, 4, t.readBits(11, 4));
  }

  function nmiChange() {
    let nmi = nmiOutput && nmiOccurred;
    if (nmi && !nmiPrevious) {
      nmiDelay = 15;
    }
    nmiPrevious = nmi;
  }

  function setVerticalBlank() {
    nmiOccurred = true;
    nmiChange();
  }

  function clearVerticalBlank() {
    nmiOccurred = false;
    nmiChange();
  }

  function fetchNameTableByte() {
    nameTableByte = Read(0x2000 | (v.read() & 0x0FFF));
  }

  function fetchAttributeTableByte() {
    let v = v.read();
    let addr= 0x23C0 | (v & 0x0C00) | ((v >> 4) & 0x38) | ((v >> 2) & 0x07);
    let shift = ((v >> 4) & 4) (v & 2);
    attributeTableByte = ((Read(addr) >> shift) & 0x3) << 2;
  }

  function fetchLowTileByte() {
    let fineY = v.readBits(12, 3);
    let table = flagBackgroundTable;
    let tile = nameTableByte;
    let addr = table * 0x1000 + tile * 16 + fineY;
    lowTileByte = Read(addr);
  }

  function fetchHighTileByte() {
    let fineY = v.readBits(12, 3);
    let table = flagBackgroundTable;
    let tile = nameTableByte;
    let addr = table * 0x1000 + tile * 16 + fineY;
    highTileByte = Read(addr + 8);
  }

  function storeTileData() {
    let data = 0;
    for (let i = 0; i < 8; i++) {
      let a = attributeTableByte;
      let p1 = (lowTileByte & 0x80) >> 7;
      let p2 = (highTileByte & 0x80) >> 6;
      lowTileByte <<= 1;
      highTileByte <<= 1;
      data <<= 4;
      data |= (a | p2 | p1);
    }
    tileData |= data;
  }

  function fetchTileData() {
    // 高32位为前一个（当前）tile
    return tileData >> 32;
  }

  function backgroundPixel() {
    if (! flagShowBackground) {
      return 0;
    }
    let data = fetchTileData() >> ((7 - x.read()) * 4);
    return data & 0x0F;
  }

  function spritePixel() {
    if (! flagShowSprites) {
      return [0, 0];
    }
    for (let i = 0; i < spriteCount; i++) {
      let offset = Cycle - 1 - spritePositions[i];
      if (offset < 0 || offset > 7) {
        continue;
      }
      offset = 7 - offset;
      let color = ((spritePatterns[i] >> offset * 4 & 0x0F));
      if (color % 4 === 0) {
        continue;
      }
      return [i, color];
    }
    return [0, 0];
  }

  function renderPixel() {
    let x = Cycle - 1;
    let y = ScanLine;
    let bg = backgroundPixel();
    let [i, spr] = spritePixel();
    if (x < 8 && flagShowLeftBackground === 0) {
      bg = 0;
    }
    if (x < 8 && flagShowLeftSprites === 0) {
      spr = 0;
    }
    let b = bg % 4 !== 0;
    let s = spr % 4 !== 0;

    let color;
    if (!b && !s) {
      color = 0;
    } else if (!b && s) {
      color = spr | 0x10;
    } else if (b && !s) {
      color = bg;
    } else {
      if (spriteIndexes[i] === 0 && x < 255) {
        flagSpriteZeroHit = 1;
      }
      if (spritePriorities[i] === 0) {
        color = spr | 0x10;
      } else {
        color = bg;
      }
    }
    let c = colorTable[readPalette(color) % 64];
    Screen.drawPixel(x, y, c);
  }

  function fetchSpritePattern(i, row) {
    let tile = OAM[i*4+1];
    let attr = OAM[i*4+2];
    let addr;
    if (!flagSpriteSize) {
      if (attr & 0x80 === 0x80) {
        row = 7 - row;
      }
      let table = flagSpriteTable;
      addr = 0x1000 * table + tile * 16 + row;
    } else {
      if (attr & 0x80 === 0x80) {
        row = 15 - row;
      }
      let table = tile & 1;
      tile &= 0xFE;
      if (row > 7) {
        tile++;
        row -= 8;
      }
      addr = 0x1000 * table + tile + row;
    }
    let a = (attr & 0x3) << 2;
    let lowTileByte = Read(addr);
    let highTileByte = Read(addr + 8);
    let data;
    for (let i = 0; i < 8; i++) {
      let p1, p2;
      if (attr & 0x40 === 0x40) {
        p1 = (lowTileByte & 1) << 0;
        p2 = (highTileByte & 1) << 1;
        lowTileByte >>= 1;
        highTileByte >>= 1;
      } else {
        p1 = (lowTileByte & 0x80) >> 7;
        p2 = (highTileByte & 0x80 >> 6);
        lowTileByte <<= 1;
        highTileByte <<= 1;
      }
      data <<= 4;
      data |= (a | p1 | p2);
    }
    return data;
  }

  function evaluateSprites() {
    let h;
    if (! flagSpriteSize) {
      h = 8;
    } else {
      h = 16;
    }
    let count = 0;
    for (let i = 0; i < 64; i++) {
      let y = OAM[i*4+0];
      let a = OAM[i*4+2];
      let x = OAM[i*4+3];
      let row = Scanline - y;
      if (row < 0 || row >=h) {
        continue;
      }
      if (count < 8) {
        spritePatterns[count] = fetchSpritePattern(i, row);
        spritePositions[count] = x;
        spritePriorities[count] = (a >> 5) & 1;
        spriteIndexes[count] = i;
      }
      count++;
    }
    if (count > 8) {
      count = 8;
      flagSpriteOverflow = 1;
    }
    spriteCount = count;
  }

  function tick() {
    if (nmiDelay > 0) {
      nmiDelay--;
      if ((! nmiDelay) && nmiOutput && nmiOccurred) {
        // triggerNMI
        CPU.triggerNMI();
      }
    }
    if (flagShowBackground || flagShowSprites) {
      if (f && Scanline === 261 && Cycle === 339) {
        Cycle = 0;
        Scanline = 0;
        Frame++;
        f ^= 1;
        return;
      }
    }
    Cycle++;
    if (Cycle > 340) {
      Cycle = 0;
      Scanline++;
      if (Scanline > 261) {
        Scanline = 0;
        Frame++;
        f ^= 1;
      }
    }
  }

  function cycle() {
    tick();
    let renderingEnabled = flagShowBackground !== 0 || flagShowSprites !== 0;
    let preLine = Scanline === 261;
    let visibleLine = Scanline < 240;
    let renderLine = preLine || visibleLine;
    let preFetchCycle = (Cycle >= 321) && (Cycle <= 336);
    let visibleCycle = (Cycle >= 1) && (Cycle <= 256);
    let fetchCycle = preFetchCycle || visibleCycle;

    if (renderingEnabled) {
      if (visibleLine && visibleCycle) {
        renderPixel();
      }
      if (renderLine && fetchCycle) {
        tileData <<= 4;
        switch(Cycle % 8) {
          case 1: fetchNameTableByte(); break;
          case 3: fetchAttributeTableByte(); break;
          case 5: fetchLowTileByte(); break;
          case 7: fetchHighTileByte(); break;
          case 0: storeTileData(); break;
        }
      }
      if (preLine && Cycle >= 280 && Cycle <= 304) {
        copyY();
      }
      if (renderLine) {
        if (fetchCycle && (Cycle % 8 === 0)) {
          incX();
        }
        if (Cycle === 256) {
          incY();
        }
        if (Cycle === 257) {
          copyX();
        }
      }
    }
    if (renderingEnabled) {
      if (Cycle === 257) {
        if (visibleLine) {
          evaluateSprites();
        } else {
          spriteCount = 0;
        }
      }
    }
    if (Scanline === 241 && Cycle === 1) {
      setVerticalBlank();
    }
    if (preLine && Cycle === 1) {
      clearVerticalBlank();
      flagSpriteZeroHit = 0;
      flagSpriteOverflow = 0;
    }
  }

  function getFrame() {
    return Frame;
  }

  const PPU = {
    register: {
      write: writeRegister,
      read: readRegister
    },
    palette: {
      write: readPalette,
      read: writePalette
    },
    nameTableData,
    cycle: cycle,
    getFrame: getFrame,
    reset: Reset
  }

  return PPU;
}

