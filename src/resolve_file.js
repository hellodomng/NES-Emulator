const HeaderFormat = [
  ['NESMagicMumber', 3],
  ['PRGNum', 4 ],
  ['CHRNum', 5 ],
  ['ctrl1', 6 ],
  ['ctrl2', 7 ],
  ['RAMNum', 8 ],
  ['_', 15 ]
];

const NESMagicMumber = 0x4e45531a;

function main(rawROM) {
  const ROMArr = getRomArr(rawROM);
  const HeaderInfo = getHeaderInfo(ROMArr);

  if (HeaderInfo.NESMagicMumber !== NESMagicMumber) {
    throw new Error('This file is not a iNES file.');
  }

  return {
    header: HeaderInfo,
    content: getROMContent(ROMArr)
  };
}

function getRomArr(rawROM) {
  return Object.keys(rawROM).map((e) => {
    return rawROM[e];
  });
}

function getHeaderInfo(ROMArr) {
  const headerInfo = {};
  let a = 0, b = 0;
  HeaderFormat.forEach((item) => {
    b = item[1];
    headerInfo[item[0]] = getROMArrSlice(ROMArr, a, b);
    a = b;
  });

  resolveCtrl(headerInfo);
  return headerInfo;
}

function resolveCtrl(headerInfo) {
  const ctrl1 = headerInfo.ctrl1;
  const ctrl2 = headerInfo.ctrl2;
  const mapperTypeLow = ctrl1 >>> 4,
    mapperTypeHigh = ctrl2 >>> 4;
  headerInfo.mapperType = (mapperTypeHigh << 4) + mapperTypeLow;
  headerInfo.VRAM = getSpecificedBit(ctrl1, 3);
  headerInfo.trainer = getSpecificedBit(ctrl1, 2);
  headerInfo.batteryBackedRAM = getSpecificedBit(ctrl1, 1);
  headerInfo.mirrorType = getSpecificedBit(ctrl1, 0);
  headerInfo.VSSystem = getSpecificedBit(ctrl2, 0);
}

function getSpecificedBit(num, i) {
  const base = 0x1;
  return (num & (base << i)) >>> i;
}

function getROMContent(ROMArr) {
  return ROMArr.slice(HeaderFormat[HeaderFormat.length-1][1] + 1);
}

function getROMArrSlice(ROMArr, a, b) {
  let r = 0;
  ROMArr.slice(a, b + 1).reverse().forEach((e, i) => {
    r += e * Math.pow(16, i * 2);
  });
  return r;
}

export default {
  main,
  getSpecificedBit,
  NESMagicMumber
};
