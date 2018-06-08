/*
 * CPU memory map
 * $0000 - $07FF  $0800  2KB internal RAM
 * $0800 - $0FFF  $0800  Mirrors of $0000 - $07FF
 * $1000 - $17FF  $0800
 * $1800 - $1FFF  $0800
 * $2000 - $2007  $0008  NES PPU registers
 * $2008 - $3FFF  $1FF8  Mirrors of $2000 - 2007 (repeats every 8 bytes)
 * $4000 - $4017  $0018  NES APU and I/O registers
 * $4018 - $401F  $0008  APU and I/O functionality that is normally disabled
 * $4020 - $FFFF  $BFE0  Cartridge space: RPG ROM, RPG RAM, and mapper registers
 */

const Mappers = (function() {
  const Mappers = Array();

  Mappers[0] = function(Cartridge) {
    this.Cartridge = Cartridge;
    this.prgBanks = Cartridge.prg.length / 0x4000;
    this.prgBank1 = 0;
    this.prgBank2 = this.prgBanks - 1;
  }

  Mappers[0].prototype.Read = function(addr) {
    let index;
    switch(true) {
      case addr < 0x2000:
        return this.Cartridge.chr[addr];
      case addr >= 0xC000:
        index = this.prgBank2 * 0x4000 + (addr - 0xC000);
        console.log(index)
        console.log(this.Cartridge.prg[index])
        return this.Cartridge.prg[index];
      case addr >= 0x8000:
        index = this.prgBank1 * 0x4000 + (addr - 0x8000);
        return this.Cartridge.prg[index];
      case addr >= 0x6000:
        index = addr - 0x6000;
        return this.Cartridge.sram[index];
      default:
        throw new Error('unhandled mapper0 read at address: ' + addr);
    }
  }

  Mappers[0].prototype.Write = function(addr, value) {
    switch(true) {
      case addr < 0x2000:
        this.Cartridge.chr[addr] = value; break;
      case addr >= 0x8000:
        this.prgBank1 = value % this.prgBanks; break;
      case addr >= 0x6000:
        let index = addr - 0x6000;
        this.Cartridge.sram = value;
        break;
      default:
        throw new Error('unhandled mapper0 write at address: ', addr);
    }
  }

  return Mappers;
})();
