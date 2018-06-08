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
    this.Cartridge
  }

  return Mappers;
})();
