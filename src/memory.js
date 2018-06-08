const Memory = function(PPU, Cartridge, Mapper) {
  const CPUMEM = new Array(0x2000);

  function CPUMEMRead(addr) {
    switch(true) {
      case addr < 0x2000:
        console.log(CPUMEM)
        return CPUMEM[addr % 0x0800];
      case addr < 0x4000:
        return PPU.register.read(0x2000 + addr % 8);
      case addr === 0x4014:
        return PPU.register.read(addr);
      case addr === 0x4015:
        return;
      case addr === 0x4016:
        return;
      case addr === 0x4017:
        return;
      case addr < 0x6000:
        return;
      case addr >= 0x6000:
        // PRG-ROM
        console.log('CPU-Read PRG-ROM: ' + addr + '->' + Mapper.Read(addr))
        return Mapper.Read(addr);
      default:
        throw new Error ('unhandled CPU memory read at address:' + addr);
    }
  }

  function CPUMEMWrite(addr, value) {
    console.log('Write CPU mem: ' + addr)
    switch(true) {
      case addr < 0x2000:
        console.log('Write CPU RAM: ' + addr)
        CPUMEM[addr % 0x0800] = value; break;
      case addr < 0x4000:
        PPU.register.write(0x2000 + addr % 8, value); break;
      case addr < 0x4014:
        break;
      case addr === 0x4014:
        PPU.register.write(addr, value); break;
      case addr === 0x4015:
        break;
      case addr === 0x4016:
        //Controller
        break
      case addr === 0x4017:
        break;
      case addr >= 0x6000:
        //写mapper
        Mapper.Write(addr, value);
        break;
      default:
        throw new Error('unhandled CPU memory write at address: ' + addr);
    }
  }


  const PPUMEM = new Array(0x4000);

  function PPUMEMRead(addr) {
    addr = addr % 0x4000;
    switch(true) {
      case addr < 0x2000:
        return Mapper.Read(addr);
      case addr < 0x3F00:
        let mode = Cartridge.mirrorType;
        return PPU.nameTableData[MirrorAddr(mode, addr) % 2048];
      case addr < 0x4000:
        return PPU.palette.read(addr % 32);
      default: 
        throw new Error('unhandled PPU memory read at address: ' + addr);
    }
  }

  function PPUMEMWrite(addr, value) {
    addr = addr % 0x4000;
    switch(true) {
      case addr < 0x2000:
        Mapper.Write(addr, value);
        break;
      case addr < 0x3F00:
        let mode = Cartridge.mirrorType;
        PPU.nameTableData[MirrorAddress(mode, address) % 2048] = value;
        break;
      case addr < 0x4000:
        PPU.palette.write(addr % 32, value);
        break;
      default:
        throw new Error('unhandled PPU memory write at address: ' + addr);
    }
  }

  const MirrorLookup = [
    [0, 0, 1, 1],
    [0, 1, 0, 1],
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 1, 2, 3],
  ]

  function MirrorAddr(mode, addr) {
    addr = (addr - 0x2000) % 0x1000;
    let table = addr / 0x0400;
    let offset = addr % 0x0400;
    return 0x2000 + MirrorLookup[mode][table] * 0x0400 + offset;
  }

  return {
    PPUMEM: {
      read: PPUMEMRead,
      write: PPUMEMWrite
    },
    CPUMEM: {
      read: CPUMEMRead,
      write: CPUMEMWrite
    }
  }
}
