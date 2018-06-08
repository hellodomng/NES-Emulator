;(function() {
  const cartridge = iNES.newCartridge();
  const cpu = CPU();
  const ppu = PPU(Palette, newPPUReg, Screen);
  const mem = Memory(ppu, cartridge);
})()
