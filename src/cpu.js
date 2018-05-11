/*
 * Anyting prefixed # is a literal number value, any other number refers to a memory location.
 */

/*
 * Addressing modes
 * - absolute
 * - zero page
 * - zero page, X
 * - zero page, Y
 * - absolute, X & absolute Y
 * - immediate
 * - relative
 * - implied
 * */

// 8-bit register
let REG_ACC,
    REG_X,
    REG_Y,
    REG_SP;

// 8-bit status register
// 7 6 5 4 3 2 1 0
// S V   B D I Z C
let REG_STA;

// 16-bit register
let REG_PC;

// Flags from status register
let F_CARRY,
    F_ZERO,
    F_INTERRUPT,
    F_DECIMAL,
    F_BRK,
    F_OVERFLOW,
    F_SIGN;

// 当前操作的数据所在的地址
let curAddr;

// 时钟数
let cycleCount = 0;

const MASK = {
  CARRY: 0x01,
  ZERO: 0x02,
  INTERRUPT: 0x04,
  DECIMAL: 0x08,
  BRK: 0x10,
  OVERFLOW: 0x40,
  SIGN: 0x80
}

function setStatus() {
  let temp = 0;
  temp = F_CARRY ? (temp | MASK.CARRY) : temp;
  temp = F_ZERO ? (temp | MASK.ZERO) : temp;
  temp = F_INTERRUPT ? (temp | MASK.INTERRUPT) : temp;
  temp = F_DECIMAL ? (temp | MASK.DECIMAL) : temp;
  temp = F_BRK ? (temp | MASK.BRK) : temp;
  temp = F_OVERFLOW ? (temp | MASK.OVERFLOW) : temp;
  temp = F_SIGN ? (temp | MASK.SIGN) : temp;

  REG_STA = temp;
}

function detachStatus() {
  F_CARRY = REG_STA & MASK.CARRY;
  F_ZERO = (REG_STA & MASK.ZERO) >> 1;
  F_INTERRUPT = (REG_STA & MASK.INTERRUPT) >> 2;
  F_DECIMAL = (REG_STA & MASK.DECIMAL) >> 3;
  F_BRK = (REG_STA & MASK.BRK) >> 4;
  F_OVERFLOW = (REG_STA & MASK.OVERFLOW) >> 6;
  F_SIGN = (REG_STA & MASK.SIGN) >> 7;
}

const setF = {
  // set if the add produced a carry, or if the subtraction don't produced a borrow. also holds bits after a logical shift. (the description from nesdev.com/6502.txt, and it is contrary with nesdev.com/6502guid.txt)
  // 【CARRY 这样写可能不正确】
  // 这里的实现是，当 v 由加法产出，仅检查它是否产生进位；当 v 由减法产出，仅检查它是否产生借位。其中，在加法情况下，认为 v 是无符号数；在减法情况下，认为 v 是有符号数，其符号位为 CARRY
  CARRY: function(v, mode) {
    if (mode === 'add') {
      F_CARRY = v > 0xFF ? 1 : 0;
    } else if (mode === 'sub') {
      F_CARRY = v < 0 ? 0 : 1;
    }
  },
  // set if the result of the last operation (load/inc/dec/add/sub) was zero
  // ZERO 跟别人写法不一样
  ZERO: function(v) {
    F_ZERO = (temp & 0xFF) ? 0 : 1;
  },
  // set if bit 7 of the accumulator is set
  SIGN: function(v) {
    F_SIGN = (v >> 7) & 0x1;
  },
  // set if the addition of two like-signed numbers or the subtraction of two unlick-signed numbers produces a result greater than +127 or less than -128
  // 参考别人的代码，不过还是不明白 OVERFLOW 为啥这样写
  OVERFLOW: function(ACC, src, sum) {
    F_OVERFLOW = ! ((ACC ^ src) & 0x80) &&  
      ((ACC ^ sum) & 0x80);
  }
}

// PC 值不能在其中发生改变
// return 要增加的PC数，如果为 undefined，则增长默认值
const InstructionAction = {
  // N Z C V
  ADC: function(v) {
    let temp = REG_ACC + v + F_CARRY;

    setF.CARRY(temp, 'add');
    setF.SIGN(temp);
    setF.ZERO(temp);
    setF.OVERFLOW(REG_ACC, v, temp);

    REG_ACC = temp & 0xFF;
  },
  // N Z
  AND: function(v) {
    let temp = REG_ACC & v;
    setF.SIGN(temp);
    setF.ZERO(temp);
    REG_ACC = temp;
  },
  // N Z C
  ASL: function(v, addrMode) {
    v <<= 1;
    setF.CARRY(v, 'add');
    v &= 0xFF;
    setF.SIGN(v);
    setF.ZERO(v);
    // stroe v in memory or accumulator depending on addressing mode
    if (addrMode === 'accumulator') {
      REG_ACC = v;
    } else {
      MEM[curAddr] = v;
    }
  },
  BCC: function(offset) {
    return !F_CARRY ? offset : undefined;
  },
  BCS: function(offset) {
    return F_CARRY ? offset : undefined;
  },
  BEQ: function(offset) {
    return F_ZERO ? offset : undefined;
  },
  // N Z V
  BIT: function(v) {
    setF.ZERO(REG_ACC & v);
    F_SIGN = v >> 7;
    F_OVERFLOW = (v >> 6) & 0x1;
  },
  BMI: function(offset) {
    return F_SIGN ? offset : undefined;
  },
  BNE: function(offset) {
    return !F_ZERO ? offset : undefined;
  },
  BPL: function(offset) {
    return !F_SIGN ? offset : undefined;
  },
  // I B
  BRK: function(v) {
    let temp = REG_PC + 1;
    PUSH((temp >> 8));
    PUSH(temp & 0xFF);
    setStatus();
    PUSH(REG_STA);
    F_BRK = 1;
    F_INTERRUPT = 1;
    return MEM[0xFFFE] | (MEM[0xFFFF] << 8);
  },
  BVC: function(offset) {
    return !F_OVERFLOW ? offset : undefined;
  },
  BVS: function(offset) {
    return F_OVERFLOW ? offset : undefined;
  },
  CLC: function(v) {
    F_CARRY = 0;
  },
  CLD: function(v) {
    F_DECIMAL = 0;
  },
  CLI: function(v) {
    F_INTERRUPT = 0;
  },
  CLV: function(v) {
    F_OVERFLOW = 0;
  },
  // N Z C
  CMP: function(v) {
    let temp = REG_ACC - v;
    setF.SIGN(temp);
    setF.ZERO(temp);
    setF.CARRY(temp, 'sub');
  },
  // N Z C
  CPX: function(v) {
    let temp = REG_X - v;
    setF.SIGN(temp);
    setF.ZERO(temp);
    setF.CARRY(temp, 'sub');
  },
  // N Z C
  CPY: function(v) {
    let temp = REG_Y - v;
    setF.SIGN(temp);
    setF.ZERO(temp);
    setF.CARRY(temp, 'sub');
  },
  // N Z
  DEC: function(v) {
    let temp = v - 1;
    setF.SIGN(temp);
    setF.ZERO(temp);
    MEM[curAddr] = temp;
  },
  // N Z
  DEX: function(v) {
    let temp = v - 1;
    setF.SIGN(temp);
    setF.ZERO(temp);
    REG_X = temp;
  },
  // N Z
  DEY: function(v) {
    let temp = v - 1;
    setF.SIGN(temp);
    setF.ZERO(temp);
    REG_Y = temp;
  },
  // N Z
  EOR: function(v) {
    let temp = REG_ACC ^ v;
    setF.SIGN(temp);
    setF.ZERO(temp);
    REG_ACC = temp;
  },
  // N Z
  INC: function(v) {
    let temp = v + 1;
    setF.SIGN(temp);
    setF.ZERO(temp);
    MEM[curAddr] = temp;
  },
  // N Z
  INX: function(v) {
    let temp = v + 1;
    setF.SIGN(temp);
    setF.ZERO(temp);
    REG_X = temp;
  },
  // N Z
  INY: function(v) {
    let temp = v + 1;
    setF.SIGN(temp);
    setF.ZERO(temp);
    REG_Y = temp;
  },
  JMP: function(v) {
    return MEM[PC + 1] | (MEM[PC + 2] << 8);
  },
  // 实现存疑
  JSR: function(v) {
    let temp = REG_PC + 3;
    PUSH(temp >> 8);
    PUSH(temp & 0xFF);
    return v;
  },
  // N Z
  LDA: function(v) {
    setF.SIGN(v);
    setF.ZERO(v);
    REG_ACC = v;
  },
  // N Z
  LDX: function(v) {
    setF.SIGN(v);
    setF.ZERO(v);
    REG_X = v;
  },
  // N Z
  LDY: function(v) {
    setF.SIGN(v);
    setF.ZERO(v);
    REG_Y = v;
  },
  // N Z C
  LSR: function(v, addrMode) {
    let temp = v >>> 1;
    F_SIGN = 0;
    setF.ZERO(temp);
    F_CARRY = v & 0x1;
    if (addrMode === 'accumulator') {
      REG_ACC = temp;
    } else {
      MEM[curAddr] = temp;
    }
  },
  NOP: function(v) {
  },
  // N Z
  ORA: function(v) {
    let temp = REG_ACC | v;
    setF.SIGN(temp);
    setF.ZERO(temp);
    REG_ACC = temp;
  },
  PHA: function(v) {
    MEM[REG_SP] = REG_ACC;
    REG_SP--;
  },
  PHP: function(v) {
    setStatus();
    MEM[REG_SP] = REG_STA;
    REG_SP--;
  },
  PLA: function(v) {
    REG_ACC = MEM[REG_SP];
    REG_SP++;
  },
  PLP: function(v) {
    detachStatus(MEM[REG_SP]);
    REG_SP++;
  },
  // N Z C
  ROL: function(v) {
    v = (v << 1) | F_CARRY;
    setF.CARRY(v, 'add');
    v &= 0xFF;
    setF.ZERO(v);
    setF.SIGN(v);
    if (addrMode === 'accumulator') {
      REG_ACC = v;
    } else {
      MEM[curAddr] = v;
    }
  },
  // N Z C
  ROR: function(v) {
    let temp = (v >>> 1) | (F_CARRY << 7);
    F_CARRY = v & 0x1;
    setF.ZERO(temp);
    setF.SIGN(temp);
    if (addrMode === 'accumulator') {
      REG_ACC = temp;
    } else {
      MEM[curAddr] = temp;
    }
  },
  // From Stack
  RTI: function(v) {
    REG_STA = PULL();
    detachStatus();
    let temp = PULL();
    temp |= (PULL() << 8);
    // REG_PC = temp;
    return temp;
  },
  RTS: function(v) {
    let temp = PULL();
    temp |= (PULL() << 8);
    // REG_PC = temp + 1;
    return temp + 1;
  },
  // N Z C V
  // 这里的实现参考 6502.txt
  SBC: function(v) {
    let temp = REG_ACC - v - (F_CARRY ? 0 : 1);
    setF.SIGN(temp);
    setF.ZERO(temp & 0xFF);
    setF.OVERFLOW(REG_ACC, v, temp);
    if (F_DECIMAL) {
      if ((REG_ACC & 0xF) - (F_CARRY ? 0 : 1) < (v & 0xF)) {
        temp -= 6;
      }
      if (temp > 0x99) {
        temp -= 0x60;
      }
    }
    setF.CARRY(temp, 'sub');
    REG_ACC = temp & 0xFF;
  },
  // C
  SEC: function(v) {
    F_CARRY = 1;
  },
  // D
  SED: function(v) {
    F_DECIMAL = 1;
  },
  // I
  SEI: function(v) {
    F_INTERRUPT = 1;
  },
  STA: function(v) {
    MEM[v] = REG_ACC;
  },
  STX: function(v) {
    MEM[v] = REG_X;
  },
  STY: function(v) {
    MEM[v] = REG_Y;
  },
  // N Z
  TAX: function(v) {
    setF.ZERO(REG_ACC);
    setF.SIGN(REG_ACC);
    REG_X = REG_ACC;
  },
  // N Z
  TAY: function(v) {
    setF.ZERO(REG_ACC);
    setF.SIGN(REG_ACC);
    REG_Y = REG_ACC;
  },
  // N Z
  TSX: function(v) {
    setF.ZERO(REG_SP);
    setF.SIGN(REG_SP);
    REG_X = REG_SP;
  },
  // N Z
  TXA: function(v) {
    setF.ZERO(REG_X);
    setF.SIGN(REG_X);
    REG_ACC = REG_X;
  },
  TXS: function(v) {
    REG_SP = REG_X;
  },
  // N Z
  TYA: function(v) {
    setF.ZERO(REG_Y);
    setF.SIGN(REG_Y);
    REG_ACC = REG_Y;
  }
}

function PULL() {
  return MEM[REG_SP++];
}

function PUSH(v) {
  MEM[--REG_SP] = v;
}

const OpcodeSet = {
  /* ADC 8 */
  '69': { inst: 'ADC', bytes: 2, cycles: 2, mode: 'immediate' },
  '65': { inst: 'ADC', bytes: 2, cycles: 3, mode: 'zeroPage' },
  '75': { inst: 'ADC', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  '60': { inst: 'ADC', bytes: 3, cycles: 4, mode: 'absolute' },
  '70': { inst: 'ADC', bytes: 3, cycles: 4, mode: 'absoluteX', add: 'pageBoundary' },
  '79': { inst: 'ADC', bytes: 3, cycles: 4, mode: 'absoluteY', add: 'pageBoundary' },
  '61': { inst: 'ADC', bytes: 2, cycles: 6, mode: 'indirectX' },
  '71': { inst: 'ADC', bytes: 2, cycles: 5, mode: 'indirect_Y', add: 'pageBoundary' },
  /* AND 8 */
  '29': { inst: 'AND', bytes: 2, cycles: 2, mode: 'immediate' },
  '25': { inst: 'AND', bytes: 2, cycles: 3, mode: 'zeroPage' },
  '35': { inst: 'AND', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  '2D': { inst: 'AND', bytes: 3, cycles: 4, mode: 'absolute' },
  '3D': { inst: 'AND', bytes: 3, cycles: 4, mode: 'absoluteX', add: 'pageBoundary' },
  '39': { inst: 'AND', bytes: 3, cycles: 4, mode: 'absoluteY', add: 'pageBoundary' },
  '21': { inst: 'AND', bytes: 2, cycles: 6, mode: 'indirectX' },
  '31': { inst: 'AND', bytes: 2, cycles: 5, mode: 'indirect_Y' },
  /* ASL 5 */
  '0A': { inst: 'ASL', bytes: 1, cycles: 2, mode: 'accumulator' },
  '06': { inst: 'ASL', bytes: 2, cycles: 5, mode: 'zeroPage' },
  '16': { inst: 'ASL', bytes: 2, cycles: 6, mode: 'zeroPageX' },
  '0E': { inst: 'ASL', bytes: 3, cycles: 6, mode: 'absolute' },
  '1E': { inst: 'ASL', bytes: 3, cycles: 7, mode: 'absoluteX' },
  /* BCC 1 */
  '90': { inst: 'BCC', bytes: 2, cycles: 2, mode: 'relative', add: ['samePage', 'differentPage'] },
  /* BCS 1 */
  'B0': { inst: 'BCS', bytes: 2, cycles: 2, mode: 'relative', add: ['samePage', 'nextPage'] },
  /* BEQ 1 */
  'F0': { inst: 'BEQ', bytes: 2, cycles: 2, mode: 'relative', add: ['samePage', 'nextPage'] },
  /* BIT 2 */
  '24': { inst: 'BIT', bytes: 2, cycles: 3, mode: 'zeroPage' },
  '2C': { inst: 'BIT', bytes: 3, cycles: 4, mode: 'absolute' },
  /* BMI 1 */
  '30': { inst: 'BMI', bytes: 2, cycles: 2, mode: 'relative', add: ['samePage', 'differentPage'] },
  /* BNE 1 */
  'D0': { inst: 'BNE', bytes: 2, cycles: 2, mode: 'relative', add: ['samePage', 'differentPage'] },
  /* BPL 1 */
  '10': { inst: 'BPL', bytes: 2, cycles: 2, mode: 'relative', add: ['samePage', 'differentPage'] },
  /* BRK 1 */
  '00': { inst: 'BRK', bytes: 1, cycles: 7, mode: 'implied' },
  /* BVC 1 */
  '50': { inst: 'BVC', bytes: 2, cycles: 2, mode: 'relative', add: ['samePage', 'differentPage'] },
  /* BVS 1 */
  '70': { inst: 'BVS', bytes: 2, cycles: 2, mode: 'relative', add: ['samePage', 'differentPage'] },
  /* CLC 1 */
  '18': { inst: 'CLC', bytes: 1, cycles: 2, mode: 'implied' },
  /* CLD 1 */
  'D8': { inst: 'CLD', bytes: 1, cycles: 2, mode: 'implied' },
  /* CLI 1 */
  '58': { inst: 'CLI', bytes: 1, cycles: 2, mode: 'implied' },
  /* CLV 1 */
  'B8': { inst: 'CLV', bytes: 1, cycles: 2, mode: 'implied' },
  /* CMP 8 */
  'C9': { inst: 'CMP', bytes: 2, cycles: 2, mode: 'immediate' },
  'C5': { inst: 'CMP', bytes: 2, cycles: 3, mode: 'zeroPage' },
  'D5': { inst: 'CMP', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  'CD': { inst: 'CMP', bytes: 3, cycles: 4, mode: 'absolute' },
  'DD': { inst: 'CMP', bytes: 3, cycles: 4, mode: 'absoluteX', add: 'pageBoundary' },
  'D9': { inst: 'CMP', bytes: 3, cycles: 4, mode: 'absoluteY', add: 'pageBoundary' },
  'C1': { inst: 'CMP', bytes: 2, cycles: 6, mode: 'indirectX', },
  'D1': { inst: 'CMP', bytes: 2, cycles: 5, mode: 'indirect_Y', add: 'pageBoundary' },
  /* CPX 3 */
  'E0': { inst: 'CPX', bytes: 2, cycles: 2, mode: 'immediate' },
  'E4': { inst: 'CPX', bytes: 2, cycles: 3, mode: 'zeroPage' },
  'EC': { inst: 'CPX', bytes: 3, cycles: 4, mode: 'absolute' },
  /* CPY 3 */
  'C0': { inst: 'CPY', bytes: 2, cycles: 2, mode: 'immediate' },
  'C4': { inst: 'CPY', bytes: 2, cycles: 3, mode: 'zeroPage' },
  'CC': { inst: 'CPY', bytes: 3, cycles: 4, mode: 'absolute' },
  /* DEC 4 */
  'C6': { inst: 'DEC', bytes: 2, cycles: 5, mode: 'zeroPage' },
  'D6': { inst: 'DEC', bytes: 2, cycles: 6, mode: 'zeroPageX' },
  'CE': { inst: 'DEC', bytes: 3, cycles: 6, mode: 'absolute' },
  'DE': { inst: 'DEC', bytes: 3, cycles: 7, mode: 'absoluteX' },
  /* DEX 1 */
  'CA': { inst: 'DEX', bytes: 1, cycles: 2, mode: 'implied' },
  /* DEY 1 */
  '88': { inst: 'DEY', bytes: 1, cycles: 2, mode: 'implied' },
  /* EOR 8 */
  '49': { inst: 'EOR', bytes: 2, cycles: 2, mode: 'immediate' },
  '45': { inst: 'EOR', bytes: 2, cycles: 3, mode: 'zeroPage' },
  '55': { inst: 'EOR', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  '40': { inst: 'EOR', bytes: 3, cycles: 4, mode: 'absolute' },
  '50': { inst: 'EOR', bytes: 3, cycles: 4, mode: 'absoluteX', add: 'pageBoundary' },
  '59': { inst: 'EOR', bytes: 3, cycles: 4, mode: 'absoluteY', add: 'pageBoundary' },
  '41': { inst: 'EOR', bytes: 2, cycles: 6, mode: 'indirectX', },
  '51': { inst: 'EOR', bytes: 2, cycles: 5, mode: 'indirect_Y', add: 'pageBoundary' },
  /* INC 4*/
  'E6': { inst: 'INC', bytes: 2, cycles: 5, mode: 'zeroPage' },
  'F6': { inst: 'INC', bytes: 2, cycles: 6, mode: 'zeroPageX' },
  'EE': { inst: 'INC', bytes: 3, cycles: 6, mode: 'absolute' },
  'FE': { inst: 'INC', bytes: 3, cycles: 7, mode: 'absoluteX' },
  /* INX 1 */
  'E8': { inst: 'INX', bytes: 1, cycles: 2, mode: 'implied' },
  /* INY 1 */
  'C8': { inst: 'INY', bytes: 1, cycles: 2, mode: 'implied' },
  /* JMP 2 */
  '4C': { inst: 'JMP', bytes: 3, cycles: 3, mode: 'absolute' },
  '6C': { inst: 'JMP', bytes: 3, cycles: 5, mode: 'indirect' },
  /* JSR 1 */
  '20': { inst: 'JSP', bytes: 3, cycles: 6, mode: 'absolute' },
  /* LDA 8 */
  'A9': { inst: 'LDA', bytes: 2, cycles: 2, mode: 'immediate' },
  'A5': { inst: 'LDA', bytes: 2, cycles: 3, mode: 'zeroPage' },
  'B5': { inst: 'LDA', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  'AD': { inst: 'LDA', bytes: 3, cycles: 4, mode: 'absolute' },
  'BD': { inst: 'LDA', bytes: 3, cycles: 4, mode: 'absoluteX', add: 'pageBoundary' },
  'B9': { inst: 'LDA', bytes: 3, cycles: 4, mode: 'absoluteY', add: 'pageBoundary' },
  'A1': { inst: 'LDA', bytes: 2, cycles: 6, mode: 'indirectX' },
  'B1': { inst: 'LDA', bytes: 2, cycles: 5, mode: 'indirect_Y', add: 'pageBoundary' },
  /* LDX 5 */
  'A2': { inst: 'LDX', bytes: 2, cycles: 2, mode: 'immediate' },
  'A6': { inst: 'LDX', bytes: 2, cycles: 3, mode: 'zeroPage' },
  'B6': { inst: 'LDX', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  'AE': { inst: 'LDX', bytes: 3, cycles: 4, mode: 'absolute' },
  'BE': { inst: 'LDX', bytes: 3, cycles: 4, mode: 'absoluteY', add: 'pageBoundary' },
  /* LDY 5 */
  'A0': { inst: 'LDY', bytes: 2, cycles: 2, mode: 'immediate' },
  'A4': { inst: 'LDY', bytes: 2, cycles: 3, mode: 'zeroPage' },
  'B4': { inst: 'LDY', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  'AC': { inst: 'LDY', bytes: 3, cycles: 4, mode: 'absolute' },
  'BC': { inst: 'LDY', bytes: 3, cycles: 4, mode: 'absoluteX', ad: 'pageBoundary' },
  /* LSR 5 */
  '4A': { inst: 'LSR', bytes: 1, cycles: 2, mode: 'accumulator' },
  '46': { inst: 'LSR', bytes: 2, cycles: 5, mode: 'zeroPage' },
  '56': { inst: 'LSR', bytes: 2, cycles: 6, mode: 'zeroPageX' },
  '4E': { inst: 'LSR', bytes: 3, cycles: 6, mode: 'absolute' },
  '5E': { inst: 'LSR', bytes: 3, cycles: 7, mode: 'absoluteX' },
  /* NOP 1 */
  'EA': { inst: 'NOP', bytes: 1, cycles: 2, mode: 'implied' },
  /* ORA 8 */
  '09': { inst: 'ORA', bytes: 2, cycles: 2, mode: 'immediate' },
  '05': { inst: 'ORA', bytes: 2, cycles: 3, mode: 'zeroPage' },
  '15': { inst: 'ORA', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  '0D': { inst: 'ORA', bytes: 3, cycles: 4, mode: 'absolute' },
  '1D': { inst: 'ORA', bytes: 3, cycles: 4, mode: 'absoluteX', add: 'pageCrossing' },
  '19': { inst: 'ORA', bytes: 3, cycles: 4, mode: 'absoluteY', add: 'pageCrossing' },
  '01': { inst: 'ORA', bytes: 2, cycles: 6, mode: 'indirectX' },
  '11': { inst: 'ORA', bytes: 2, cycles: 5, mode: 'indirect_Y' },
  /* PHA 1 */
  '48': { inst: 'PHA', bytes: 1, cycles: 3, mode: 'implied' },
  /* PHP 1 */
  '08': { inst: 'PHP', bytes: 1, cycles: 3, mode: 'implied' },
  /* PLA 1 */
  '68': { inst: 'PLA', bytes: 1, cycles: 4, mode: 'implied' },
  /* PLP 1 */
  '28': { inst: 'PLP', bytes: 1, cycles: 4, mode: 'implied' },
  /* ROL 5 */
  '2A': { inst: 'ROL', bytes: 1, cycles: 2, mode: 'accumulator' },
  '26': { inst: 'ROL', bytes: 2, cycles: 5, mode: 'zeroPage' },
  '36': { inst: 'ROL', bytes: 2, cycles: 6, mode: 'zeroPageX' },
  '2E': { inst: 'ROL', bytes: 3, cycles: 6, mode: 'absolute' },
  '3E': { inst: 'ROL', bytes: 3, cycles: 7, mode: 'absoluteX' },
  /* ROR 5 */
  '6A': { inst: 'ROR', bytes: 1, cycles: 2, mode: 'accumulator' },
  '66': { inst: 'ROR', bytes: 2, cycles: 5, mode: 'zeroPage' },
  '76': { inst: 'ROR', bytes: 2, cycles: 6, mode: 'zeroPageX' },
  '6E': { inst: 'ROR', bytes: 3, cycles: 6, mode: 'absolute' },
  '7E': { inst: 'ROR', bytes: 3, cycles: 7, mode: 'absoluteX' },
  /* RTI 1 */
  '4D': { inst: 'RTI', bytes: 1, cycles: 6, mode: 'implied' },
  /* RTS 1 */
  '60': { inst: 'RTS', bytes: 1, cycles: 6, mode: 'implied' },
  /* SBC 8 */
  'E9': { inst: 'SBC', bytes: 2, cycles: 2, mode: 'immediate' },
  'E5': { inst: 'SBC', bytes: 2, cycles: 3, mode: 'zeroPage' },
  'F5': { inst: 'SBC', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  'ED': { inst: 'SBC', bytes: 3, cycles: 4, mode: 'absolute' },
  'FD': { inst: 'SBC', bytes: 3, cycles: 4, mode: 'absoluteX', add: 'pageBoundary' },
  'F9': { inst: 'SBC', bytes: 3, cycles: 4, mode: 'absoluteY', add: 'pageBoundary' },
  'E1': { inst: 'SBC', bytes: 2, cycles: 6, mode: 'indirectX' },
  'F1': { inst: 'SBC', bytes: 2, cycles: 5, mode: 'indirect_Y' },
  /* SEC 1 */
  '38': { inst: 'SEC', bytes: 1, cycles: 2, mode: 'implied' },
  /* SED 1 */
  'F8': { inst: 'SED', bytes: 1, cycles: 2, mode: 'implied' },
  /* SEI 1 */
  '78': { inst: 'SEI', bytes: 1, cycles: 2, mode: 'implied' },
  /* STA 7 */
  '85': { inst: 'STA', bytes: 2, cycles: 3, mode: 'zeroPage' },
  '95': { inst: 'STA', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  '80': { inst: 'STA', bytes: 3, cycles: 4, mode: 'absolute' },
  '90': { inst: 'STA', bytes: 3, cycles: 5, mode: 'absoluteX' },
  '99': { inst: 'STA', bytes: 3, cycles: 5, mode: 'absoluteY' },
  '81': { inst: 'STA', bytes: 2, cycles: 6, mode: 'indirectX' },
  '91': { inst: 'STA', bytes: 2, cycles: 6, mode: 'indirect_Y' },
  /* STX 3 */
  '86': { inst: 'STX', bytes: 2, cycles: 3, mode: 'zeroPage' },
  '96': { inst: 'STX', bytes: 2, cycles: 4, mode: 'zeroPageY' },
  '8E': { inst: 'STX', bytes: 3, cycles: 4, mode: 'absolute' },
  /* STY 3 */
  '84': { inst: 'STY', bytes: 2, cycles: 3, mode: 'zeroPage' },
  '94': { inst: 'STY', bytes: 2, cycles: 4, mode: 'zeroPageX' },
  '8C': { inst: 'STY', bytes: 3, cycles: 4, mode: 'absolute' },
  /* TAX 1 */
  'AA': { inst: 'TAX', bytes: 1, cycles: 2, mode: 'implied'},
  /* TAY 1*/
  'A8': { inst: 'TAY', bytes: 1, cycles: 2, mode: 'implied' },
  /* TSX 1 */
  'BA': { inst: 'TSX', bytes: 1, cycles: 2, mode: 'implied' },
  /* TXA 1 */
  '8A': { inst: 'TXA', bytes: 1, cycles: 2, mode: 'implied' },
  /* TXS 1 */
  '9A': { inst: 'TXS', bytes: 1, cycles: 2, mode: 'implied' },
  /* TYA 1 */
  '98': { inst: 'TYA', bytes: 1, cycles: 2, mode: 'implied' }
}

const addExtraCycles = {
  pageBoundary: 1,
  samePage: 1,
  differentPage: 2,
  nextPage: 2
}

const CPU = {
  ROM: null,
  reset: function() {
    REG_ACC = 0;
    REG_X = 0;
    REG_Y = 0;
    REG_SP = 0x01FF;
    REG_PC = 0x8000 - 1;
    REG_STA = 0b00101000;//0x28;
  },
  run: function(opcode) {
    if (!ROM) {
      throw new Error('没有ROM');
    }
    this.reset();
  },
  getSOpcode: function(index) {
    return this.ROM[index];
  },
  getLOpcode: function(index) {
    return this.ROM[index] | (this.ROM[index + 1] << 8);
  },
  execute: function() {
    let inst = OpcodeSet[getSOpcode(REG_PC)];
    let operand;
    if (inst.bytes === 1) {
      operand = null;
    } else if (inst.bytes === 2) {
      operand = getSOpcode(REG_PC + 1);
    } else {
      operand = getLOpcode(REG_PC + 1);
    }
    let value = Operand[inst.mode](operand)
    let PCOffset = InstructionAction[inst.inst](value, inst.mode);
    if (PCOffset !== undefined) {
      REG_PC += PCOffset;
    } else {
      REG_PC += inst.bytes;
    }
    // 未处理 same page 等特殊情况
    //cycleCount += inst.cycles;
    return inst.cycles;
  }
}

const Operand = {
  immediate: function(v) {
    curAddr = null;
    return v;
  },
  zeroPage: function(v) {
    curAddr = v;
    return MEM[v];
  },
  zeroPageX: function(v) {
    let addr = (v + REG_X) & 0xFF;
    curAddr = addr;
    return MEM[addr];
  },
  zeroPageY: function(v) {
    let addr = (v + REG_Y) & 0xFF;
    curAddr = addr;
    return MEM[addr];
  },
  absolute: function(v) {
    curAddr = v;
    return MEM[v];
  },
  absoluteX: function(v) {
    let addr = (v + REG_X) & 0xFFFF;
    curAddr = addr;
    return MEM[addr];
  },
  absoluteY: function(v) {
    let addr = (v + REG_Y) & 0xFFFF;
    curAddr = addr;
    return MEM[addr];
  },
  indirect: function(v) {
    let addr = MEM[v];
    curAddr = addr;
    return MEM[addr]
  },
  indirectX: function(v) {
    let addr1 = v + REG_X;
    let addr2 = parseInt('0x' + MEM[addr1 + 1] + MEM[addr1], 16);
    curAddr = addr2;
    return MEM[addr2];
  },
  indirect_Y: function(v) {
    let addr1 = parseInt('0x' + MEM[v + 1] + MEM[v], 16);
    let addr2 = addr1 + REG_Y;
    curAddr = addr2;
    return MEM[addr2];
  },
  relative: function(v) {
    let offset = (v & 0x80) >> 7 ? -(v & 0x7F) : v & 0x7F;
    // REG_PC += val;
    curAddr = null;
    return offset;
  },
  accumulator: function(v) {
    return REG_ACC;
  },
  implied: function(v) {
  }
}

/*
 * Decremented every time a byte is pushed onto the stack, and incremented when a byte is popped off the stack.
 */

export default CPU;
