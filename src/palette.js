const Palette = (function() {
  const colorTable = new Array(64);
  colorTable[0] = getRgb(117, 117, 117);
  colorTable[1] = getRgb(39, 27, 143);
  colorTable[2] = getRgb(0, 0, 171);
  colorTable[3] = getRgb(71, 0, 159);
  colorTable[4] = getRgb(143, 0, 119);
  colorTable[5] = getRgb(171, 0, 19);
  colorTable[6] = getRgb(167, 0, 0);
  colorTable[7] = getRgb(127, 11, 0);
  colorTable[8] = getRgb(67, 47, 0);
  colorTable[9] = getRgb(0, 71, 0);
  colorTable[10] = getRgb(0, 81, 0);
  colorTable[11] = getRgb(0, 63, 23);
  colorTable[12] = getRgb(27, 63, 95);
  colorTable[13] = getRgb(0, 0, 0);
  colorTable[14] = getRgb(0, 0, 0);
  colorTable[15] = getRgb(0, 0, 0);
  colorTable[16] = getRgb(188, 188, 188);
  colorTable[17] = getRgb(0, 115, 239);
  colorTable[18] = getRgb(35, 59, 239);
  colorTable[19] = getRgb(131, 0, 243);
  colorTable[20] = getRgb(191, 0, 191);
  colorTable[21] = getRgb(231, 0, 91);
  colorTable[22] = getRgb(219, 43, 0);
  colorTable[23] = getRgb(203, 79, 15);
  colorTable[24] = getRgb(139, 115, 0);
  colorTable[25] = getRgb(0, 151, 0);
  colorTable[26] = getRgb(0, 171, 0);
  colorTable[27] = getRgb(0, 147, 59);
  colorTable[28] = getRgb(0, 131, 139);
  colorTable[29] = getRgb(0, 0, 0);
  colorTable[30] = getRgb(0, 0, 0);
  colorTable[31] = getRgb(0, 0, 0);
  colorTable[32] = getRgb(255, 255, 255);
  colorTable[33] = getRgb(63, 191, 255);
  colorTable[34] = getRgb(95, 151, 255);
  colorTable[35] = getRgb(167, 139, 253);
  colorTable[36] = getRgb(247, 123, 255);
  colorTable[37] = getRgb(255, 119, 183);
  colorTable[38] = getRgb(255, 119, 99);
  colorTable[39] = getRgb(255, 155, 59);
  colorTable[40] = getRgb(243, 191, 63);
  colorTable[41] = getRgb(131, 211, 19);
  colorTable[42] = getRgb(79, 223, 75);
  colorTable[43] = getRgb(88, 248, 152);
  colorTable[44] = getRgb(0, 235, 219);
  colorTable[45] = getRgb(0, 0, 0);
  colorTable[46] = getRgb(0, 0, 0);
  colorTable[47] = getRgb(0, 0, 0);
  colorTable[48] = getRgb(255, 255, 255);
  colorTable[49] = getRgb(171, 231, 255);
  colorTable[50] = getRgb(199, 215, 255);
  colorTable[51] = getRgb(215, 203, 255);
  colorTable[52] = getRgb(255, 199, 255);
  colorTable[53] = getRgb(255, 199, 219);
  colorTable[54] = getRgb(255, 191, 179);
  colorTable[55] = getRgb(255, 219, 171);
  colorTable[56] = getRgb(255, 231, 163);
  colorTable[57] = getRgb(227, 255, 163);
  colorTable[58] = getRgb(171, 243, 191);
  colorTable[59] = getRgb(179, 255, 207);
  colorTable[60] = getRgb(159, 255, 243);
  colorTable[61] = getRgb(0, 0, 0);
  colorTable[62] = getRgb(0, 0, 0);
  colorTable[63] = getRgb(0, 0, 0);

  function getRgb(r, g, b) {
    return (r << 16) | (g << 8) | b;
  }

  return colorTable;
})();
