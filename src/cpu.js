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

const CPU = function(CPUMEM) {
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

  // 当前要发生的中断
  let interrupt = 0;

  // 页交叉
  let pageCrossed = false;
  // 不同页
  let inSamePage;

  const NMI_Vector = 0xFFFA;
  const IRQ_Vector = 0xFFFE;
  const Reset_Vector = 0xFFFC;
  const interruptNone = 0;
  const interruptNMI = 1;
  const interruptIRQ = 2;
  const InterruptSet = [
    {name: 'None', cycles: 0, priority: 0},
    {name: 'NMI', cycles: 7, priority: 2},
    {name: 'IRQ', cycles: 7, priority: 1}
  ];

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

  function setZ(v){
    F_ZERO = (v === 0) ? 1 : 0;
  }
  function setN(v) {
    F_SIGN = (v >> 7) & 0x1;
  }
  function setZN(v) {
    setZ(v);
    setN(v);
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
    ZERO: function(v) {
    },
    // set if bit 7 of the accumulator is set
    SIGN: function(v) {
    },
    // set if the addition of two like-signed numbers or the subtraction of two unlick-signed numbers produces a result greater than +127 or less than -128
    // 参考别人的代码，不过还是不明白 OVERFLOW 为啥这样写
    OVERFLOW: function(ACC, src, sum) {
      F_OVERFLOW = ! ((ACC ^ src) & 0x80) &&  
        ((ACC ^ sum) & 0x80);
    }
  }

  function int8(v) {
    return v & 0xFF;
  }

  function compare(a, b) {
    setZN(a - b);
    if (a >= b) {
      F_CARRY = 1;
    } else {
      F_CARRY = 0;
    }
  }

  // PC 值不能在其中发生改变
  // return 要增加的PC数，如果为 undefined，则增长默认值
  const InstructionAction = {
    // N Z C V
    ADC: function(v) {
      let a = REG_ACC, b = v, c = F_CARRY;
      let temp = REG_ACC + v + F_CARRY;
      REG_ACC = int8(temp);
      setZN(REG_ACC);
      if (temp > 0xFF) {
        F_CARRY = 1;
      } else {
        F_CARRY = 0;
      }
      if (((a ^ b) & 0x80 === 0) && ((a ^ REG_ACC) & 0x80 !== 0)) {
        F_OVERFLOW = 1;
      } else {
        F_OVERFLOW = 0;
      }
    },
    // N Z
    AND: function(v) {
      REG_ACC = REG_ACC & v;
      setZN(REG_ACC);
    },
    // N Z C
    ASL: function(v, addrMode) {
      // stroe v in memory or accumulator depending on addressing mode
      if (addrMode === 'accumulator') {
        F_CARRY = (REG_ACC >> 7) & 1;
        REG_ACC <<= 1;
        setZN(REG_ACC);
      } else {
        F_CARRY = (v >> 7) & 1;
        v <<= 1;
        writeMem(curAddr, v);
        setZN(v);
      }
    },
    BCC: function(v) {
      return !F_CARRY ? v : undefined;
    },
    BCS: function(v) {
      return F_CARRY ? v : undefined;
    },
    BEQ: function(v) {
      return F_ZERO ? v : undefined;
    },
    // N Z V
    BIT: function(v) {
      setZ(REG_ACC & v);
      setN(v);
      F_OVERFLOW = (v >> 6) & 0x1;
    },
    BMI: function(v) {
      return F_SIGN ? v : undefined;
    },
    BNE: function(v) {
      return !F_ZERO ? v : undefined;
    },
    BPL: function(v) {
      return !F_SIGN ? v : undefined;
    },
    // I B
    BRK: function(v) {
      triggerIRQ();
      F_BRK = 1;
      F_INTERRUPT = 1;
      //return readMem(0xFFFE) | (readMem(0xFFFF) << 8);
    },
    BVC: function(v) {
      return !F_OVERFLOW ? v : undefined;
    },
    BVS: function(v) {
      return F_OVERFLOW ? v : undefined;
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
      compare(REG_ACC, v);
    },
    // N Z C
    CPX: function(v) {
      compare(REG_X, v);
    },
    // N Z C
    CPY: function(v) {
      compare(REG_Y, v);
    },
    // N Z
    DEC: function(v) {
      v = v - 1;
      setZN(v);
      writeMem(curAddr, v);
    },
    // N Z
    DEX: function(v) {
      REG_X--;
      setZN(REG_X);
    },
    // N Z
    DEY: function(v) {
      REG_Y--;
      setZN(REG_Y);
    },
    // N Z
    EOR: function(v) {
      REG_ACC = REG_ACC ^ v;
      setZN(REG_ACC);
    },
    // N Z
    INC: function(v) {
      v = v + 1;
      setZN(v);
      writeMem(curAddr, v);
    },
    // N Z
    INX: function(v) {
      REG_X++;
      setZN(REG_X);
    },
    // N Z
    INY: function(v) {
      REG_Y++;
      setZN(REG_Y);
    },
    JMP: function(v) {
      return curAddr;
    },
    // 实现存疑
    JSR: function(v) {
      //let temp = REG_PC + 3;
      //PUSH(temp >> 8);
      //PUSH(temp & 0xFF);
      //http://www.masswerk.at/6502/6502_instruction_set.html#JSR
      //the doc above shows JSR should push (PC+2) instead of PC+2
      PUSH16(REG_PC - 1);
      return curAddr;

      return curAddr;
    },
    // N Z
    LDA: function(v) {
      setZN(v);
      REG_ACC = v;
    },
    // N Z
    LDX: function(v) {
      setZN(v)
      REG_X = v;
    },
    // N Z
    LDY: function(v) {
      setZN(v);
      REG_Y = v;
    },
    // N Z C
    LSR: function(v, addrMode) {
      if (addrMode === 'accumulator') {
        F_CARRY = REG_ACC & 1;
        REG_ACC >>= 1;
        setZN(REG_ACC);
      } else {
        F_CARRY = v & 1;
        v >>= 1;
        writeMem(curAddr, temp);
        setZN(v);
      }
    },
    NOP: function(v) {
    },
    // N Z
    ORA: function(v) {
      REG_ACC = REG_ACC | v;
      setZN(REG_ACC);
    },
    PHA: function(v) {
      PUSH(REG_ACC);
    },
    PHP: function(v) {
      setStatus();
      PUSH(REG_STA | 0x10);
    },
    // N Z
    PLA: function(v) {
      REG_ACC = PULL();
      setZN(REG_ACC);
    },
    PLP: function(v) {
      detachStatus(PULL() & 0xEF | 0x20);
    },
    // N Z C
    ROL: function(v) {
      if (addrMode === 'accumulator') {
        let c = F_CARRY;
        F_CARRY = (REG_ACC >> 7) & 1;
        REG_ACC = (REG_ACC << 1) | c;
        setZN(REG_ACC);
      } else {
        let c = F_CARRY;
        F_CARRY = (v >> 7) & 1;
        v = (v << 1) | c;
        writeMem(curAddr, v);
        setZN(v);
      }
    },
    // N Z C
    ROR: function(v) {
      if (addrMode === 'accumulator') {
        let c = F_CARRY;
        F_CARRY = REG_ACC & 1;
        REG_ACC = (REG_ACC >> 1) | (c << 7);
      } else {
        let c = F_CARRY;
        F_CARRY = v & 1;
        v = (v >> 1) | (c << 7);
        writeMem(curAddr, v);
        setZN(v);
      }
    },
    // From Stack
    RTI: function(v) {
      REG_STA = PULL() & 0xEF | 0x20;
      detachStatus();
      return PULL16();
    },
    RTS: function(v) {
      return PULL16() + 1;
    },
    // N Z C V
    // 这里的实现参考 6502.txt
    SBC: function(v) {
      let a = REG_ACC, b = v, c = F_CARRY;
      REG_ACC = a - b - (1 - c);
      setZN(REG_ACC);
      if ((a - b- (1 - c)) >= 0) {
        F_CARRY = 1;
      } else {
        F_CARRY = 0;
      }
      if (((a ^ b) & 0x80 !== 0) && ((a ^ REG_ACC) & 0x80 !== 0)) {
        F_OVERFLOW = 1;
      } else {
        F_OVERFLOW = 0;
      }
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
      writeMem(curAddr, REG_ACC);
    },
    STX: function(v) {
      writeMem(curAddr, REG_X);
    },
    STY: function(v){
      writeMem(curAddr, REG_Y);
    },
    // N Z
    TAX: function(v) {
      REG_X = REG_ACC;
      setZN(REG_X);
    },
    // N Z
    TAY: function(v) {
      REG_Y = REG_ACC;
      setZN(REG_Y);
    },
    // N Z
    TSX: function(v) {
      REG_X = REG_SP;
      setZN(REG_X);
    },
    // N Z
    TXA: function(v) {
      REG_ACC = REG_X;
      setZN(REG_ACC);
    },
    TXS: function(v) {
      REG_SP = REG_X;
    },
    // N Z
    TYA: function(v) {
      REG_ACC = REG_Y;
      setZN(REG_ACC);
    }
  }

  function PULL() {
    return readMem(++REG_SP);
  }

  function PUSH(v) {
    console.log('REG_SP: ' + REG_SP)
    writeMem(REG_SP--, v);
  }

  function PUSH16(v) {
    let lo = v & 0xFF;
    let hi = v >> 8;
    PUSH(hi);
    PUSH(lo);
  }

  function PULL16() {
    let lo = PULL();
    let hi = PULL();
    return lo | (hi << 8);
  }

  function NMI() {
    setStatus();
    PUSH16(REG_PC);
    PUSH(REG_STA);
    interrupt = interruptNone;
    F_INTERRUPT = 1;

    return Read16(NMI_Vector);
  }

  function IRQ() {
    setStatus();
    PUSH16(REG_PC);
    PUSH(REG_STA);
    F_INTERRUPT = 1;
    interrupt = interruptNone;

    return Read16(IRQ_Vector);
  }

  function triggerNMI() {
    interrupt = 1;
  }
  function triggerIRQ() {
    interrupt = 2;
  }

  const OpcodeSet = {
    /* ADC 8 */
    0x69: { inst: 'ADC', bytes: 2, cycles: 2, mode: 'immediate' },
    0x65: { inst: 'ADC', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0x75: { inst: 'ADC', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0x6D: { inst: 'ADC', bytes: 3, cycles: 4, mode: 'absolute' },
    0x7D: { inst: 'ADC', bytes: 3, cycles: 4, mode: 'absoluteX', pageCrossing: 1 },
    0x79: { inst: 'ADC', bytes: 3, cycles: 4, mode: 'absoluteY', pageCrossing: 1 },
    0x61: { inst: 'ADC', bytes: 2, cycles: 6, mode: 'indirectX' },
    0x71: { inst: 'ADC', bytes: 2, cycles: 5, mode: 'indirect_Y', pageCrossing: 1 },
    /* AND 8 */
    0x29: { inst: 'AND', bytes: 2, cycles: 2, mode: 'immediate' },
    0x25: { inst: 'AND', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0x35: { inst: 'AND', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0x2D: { inst: 'AND', bytes: 3, cycles: 4, mode: 'absolute' },
    0x3D: { inst: 'AND', bytes: 3, cycles: 4, mode: 'absoluteX', pageCrossing: 1 },
    0x39: { inst: 'AND', bytes: 3, cycles: 4, mode: 'absoluteY', pageCrossing: 1 },
    0x21: { inst: 'AND', bytes: 2, cycles: 6, mode: 'indirectX' },
    0x31: { inst: 'AND', bytes: 2, cycles: 5, mode: 'indirect_Y' },
    /* ASL 5 */
    0x0A: { inst: 'ASL', bytes: 1, cycles: 2, mode: 'accumulator' },
    0x06: { inst: 'ASL', bytes: 2, cycles: 5, mode: 'zeroPage' },
    0x16: { inst: 'ASL', bytes: 2, cycles: 6, mode: 'zeroPageX' },
    0x0E: { inst: 'ASL', bytes: 3, cycles: 6, mode: 'absolute' },
    0x1E: { inst: 'ASL', bytes: 3, cycles: 7, mode: 'absoluteX' },
    /* BCC 1 */
    0x90: { inst: 'BCC', bytes: 2, cycles: 2, mode: 'relative', samePage: 1, differentPage: 2 },
    /* BCS 1 */
    0xB0: { inst: 'BCS', bytes: 2, cycles: 2, mode: 'relative', samePage: 1, differentPage: 2 },
    /* BEQ 1 */
    0xF0: { inst: 'BEQ', bytes: 2, cycles: 2, mode: 'relative', samePage: 1, differentPage: 2 },
    /* BIT 2 */
    0x24: { inst: 'BIT', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0x2C: { inst: 'BIT', bytes: 3, cycles: 4, mode: 'absolute' },
    /* BMI 1 */
    0x30: { inst: 'BMI', bytes: 2, cycles: 2, mode: 'relative', samePage: 1, differentPage: 2 },
    /* BNE 1 */
    0xD0: { inst: 'BNE', bytes: 2, cycles: 2, mode: 'relative', samePage: 1, differentPage: 2 },
    /* BPL 1 */
    0x10: { inst: 'BPL', bytes: 2, cycles: 2, mode: 'relative', samePage: 1, differentPage: 2 },
    /* BRK 1 */
    0x00: { inst: 'BRK', bytes: 1, cycles: 7, mode: 'implied' },
    /* BVC 1 */
    0x50: { inst: 'BVC', bytes: 2, cycles: 2, mode: 'relative', samePage: 1, differentPage: 2 },
    /* BVS 1 */
    0x70: { inst: 'BVS', bytes: 2, cycles: 2, mode: 'relative', samePage: 1, differentPage: 2 },
    /* CLC 1 */
    0x18: { inst: 'CLC', bytes: 1, cycles: 2, mode: 'implied' },
    /* CLD 1 */
    0xD8: { inst: 'CLD', bytes: 1, cycles: 2, mode: 'implied' },
    /* CLI 1 */
    0x58: { inst: 'CLI', bytes: 1, cycles: 2, mode: 'implied' },
    /* CLV 1 */
    0xB8: { inst: 'CLV', bytes: 1, cycles: 2, mode: 'implied' },
    /* CMP 8 */
    0xC9: { inst: 'CMP', bytes: 2, cycles: 2, mode: 'immediate' },
    0xC5: { inst: 'CMP', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0xD5: { inst: 'CMP', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0xCD: { inst: 'CMP', bytes: 3, cycles: 4, mode: 'absolute' },
    0xDD: { inst: 'CMP', bytes: 3, cycles: 4, mode: 'absoluteX', pageCrossing: 1 },
    0xD9: { inst: 'CMP', bytes: 3, cycles: 4, mode: 'absoluteY', pageCrossing: 1 },
    0xC1: { inst: 'CMP', bytes: 2, cycles: 6, mode: 'indirectX', },
    0xD1: { inst: 'CMP', bytes: 2, cycles: 5, mode: 'indirect_Y', pageCrossing: 1 },
    /* CPX 3 */
    0xE0: { inst: 'CPX', bytes: 2, cycles: 2, mode: 'immediate' },
    0xE4: { inst: 'CPX', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0xEC: { inst: 'CPX', bytes: 3, cycles: 4, mode: 'absolute' },
    /* CPY 3 */
    0xC0: { inst: 'CPY', bytes: 2, cycles: 2, mode: 'immediate' },
    0xC4: { inst: 'CPY', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0xCC: { inst: 'CPY', bytes: 3, cycles: 4, mode: 'absolute' },
    /* DEC 4 */
    0xC6: { inst: 'DEC', bytes: 2, cycles: 5, mode: 'zeroPage' },
    0xD6: { inst: 'DEC', bytes: 2, cycles: 6, mode: 'zeroPageX' },
    0xCE: { inst: 'DEC', bytes: 3, cycles: 3, mode: 'absolute' },
    0xDE: { inst: 'DEC', bytes: 3, cycles: 7, mode: 'absoluteX' },
    /* DEX 1 */
    0xCA: { inst: 'DEX', bytes: 1, cycles: 2, mode: 'implied' },
    /* DEY 1 */
    0x88: { inst: 'DEY', bytes: 1, cycles: 2, mode: 'implied' },
    /* EOR 8 */
    0x49: { inst: 'EOR', bytes: 2, cycles: 2, mode: 'immediate' },
    0x45: { inst: 'EOR', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0x55: { inst: 'EOR', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0x4D: { inst: 'EOR', bytes: 3, cycles: 4, mode: 'absolute' },
    0x5D: { inst: 'EOR', bytes: 3, cycles: 4, mode: 'absoluteX', pageCrossing: 1 },
    0x59: { inst: 'EOR', bytes: 3, cycles: 4, mode: 'absoluteY', pageCrossing: 1 },
    0x41: { inst: 'EOR', bytes: 2, cycles: 6, mode: 'indirectX', },
    0x51: { inst: 'EOR', bytes: 2, cycles: 5, mode: 'indirect_Y', pageCrossing: 1 },
    /* INC 4*/
    0xE6: { inst: 'INC', bytes: 2, cycles: 5, mode: 'zeroPage' },
    0xF6: { inst: 'INC', bytes: 2, cycles: 6, mode: 'zeroPageX' },
    0xEE: { inst: 'INC', bytes: 3, cycles: 6, mode: 'absolute' },
    0xFE: { inst: 'INC', bytes: 3, cycles: 7, mode: 'absoluteX' },
    /* INX 1 */
    0xE8: { inst: 'INX', bytes: 1, cycles: 2, mode: 'implied' },
    /* INY 1 */
    0xC8: { inst: 'INY', bytes: 1, cycles: 2, mode: 'implied' },
    /* JMP 2 */
    0x4C: { inst: 'JMP', bytes: 3, cycles: 3, mode: 'absolute' },
    0x6C: { inst: 'JMP', bytes: 3, cycles: 5, mode: 'indirect' },
    /* JSR 1 */
    0x20: { inst: 'JSR', bytes: 3, cycles: 6, mode: 'absolute' },
    /* LDA 8 */
    0xA9: { inst: 'LDA', bytes: 2, cycles: 2, mode: 'immediate' },
    0xA5: { inst: 'LDA', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0xB5: { inst: 'LDA', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0xAD: { inst: 'LDA', bytes: 3, cycles: 4, mode: 'absolute' },
    0xBD: { inst: 'LDA', bytes: 3, cycles: 4, mode: 'absoluteX', pageCrossing: 1 },
    0xB9: { inst: 'LDA', bytes: 3, cycles: 4, mode: 'absoluteY', pageCrossing: 1 },
    0xA1: { inst: 'LDA', bytes: 2, cycles: 6, mode: 'indirectX' },
    0xB1: { inst: 'LDA', bytes: 2, cycles: 5, mode: 'indirect_Y', pageCrossing :1 },
    /* LDX 5 */
    0xA2: { inst: 'LDX', bytes: 2, cycles: 2, mode: 'immediate' },
    0xA6: { inst: 'LDX', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0xB6: { inst: 'LDX', bytes: 2, cycles: 4, mode: 'zeroPageY' },
    0xAE: { inst: 'LDX', bytes: 3, cycles: 4, mode: 'absolute' },
    0xBE: { inst: 'LDX', bytes: 3, cycles: 4, mode: 'absoluteY', pageCrossing: 1 },
    /* LDY 5 */
    0xA0: { inst: 'LDY', bytes: 2, cycles: 2, mode: 'immediate' },
    0xA4: { inst: 'LDY', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0xB4: { inst: 'LDY', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0xAC: { inst: 'LDY', bytes: 3, cycles: 4, mode: 'absolute' },
    0xBC: { inst: 'LDY', bytes: 3, cycles: 4, mode: 'absoluteX', pageCrossing: 1 },
    /* LSR 5 */
    0x4A: { inst: 'LSR', bytes: 1, cycles: 2, mode: 'accumulator' },
    0x46: { inst: 'LSR', bytes: 2, cycles: 5, mode: 'zeroPage' },
    0x56: { inst: 'LSR', bytes: 2, cycles: 6, mode: 'zeroPageX' },
    0x4E: { inst: 'LSR', bytes: 3, cycles: 6, mode: 'absolute' },
    0x5E: { inst: 'LSR', bytes: 3, cycles: 7, mode: 'absoluteX' },
    /* NOP 1 */
    0xEA: { inst: 'NOP', bytes: 1, cycles: 2, mode: 'implied' },
    /* ORA 8 */
    0x09: { inst: 'ORA', bytes: 2, cycles: 2, mode: 'immediate' },
    0x05: { inst: 'ORA', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0x15: { inst: 'ORA', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0x0D: { inst: 'ORA', bytes: 3, cycles: 4, mode: 'absolute' },
    0x1D: { inst: 'ORA', bytes: 3, cycles: 4, mode: 'absoluteX', pageCrossing: 1 },
    0x19: { inst: 'ORA', bytes: 3, cycles: 4, mode: 'absoluteY', pageCrossing: 1 },
    0x01: { inst: 'ORA', bytes: 2, cycles: 6, mode: 'indirectX' },
    0x11: { inst: 'ORA', bytes: 2, cycles: 5, mode: 'indirect_Y' },
    /* PHA 1 */
    0x48: { inst: 'PHA', bytes: 1, cycles: 3, mode: 'implied' },
    /* PHP 1 */
    0x08: { inst: 'PHP', bytes: 1, cycles: 3, mode: 'implied' },
    /* PLA 1 */
    0x68: { inst: 'PLA', bytes: 1, cycles: 4, mode: 'implied' },
    /* PLP 1 */
    0x28: { inst: 'PLP', bytes: 1, cycles: 4, mode: 'implied' },
    /* ROL 5 */
    0x2A: { inst: 'ROL', bytes: 1, cycles: 2, mode: 'accumulator' },
    0x26: { inst: 'ROL', bytes: 2, cycles: 5, mode: 'zeroPage' },
    0x36: { inst: 'ROL', bytes: 2, cycles: 6, mode: 'zeroPageX' },
    0x2E: { inst: 'ROL', bytes: 3, cycles: 6, mode: 'absolute' },
    0x3E: { inst: 'ROL', bytes: 3, cycles: 7, mode: 'absoluteX' },
    /* ROR 5 */
    0x6A: { inst: 'ROR', bytes: 1, cycles: 2, mode: 'accumulator' },
    0x66: { inst: 'ROR', bytes: 2, cycles: 5, mode: 'zeroPage' },
    0x76: { inst: 'ROR', bytes: 2, cycles: 6, mode: 'zeroPageX' },
    0x6E: { inst: 'ROR', bytes: 3, cycles: 6, mode: 'absolute' },
    0x7E: { inst: 'ROR', bytes: 3, cycles: 7, mode: 'absoluteX' },
    /* RTI 1 */
    0x40: { inst: 'RTI', bytes: 1, cycles: 6, mode: 'implied' },
    /* RTS 1 */
    0x60: { inst: 'RTS', bytes: 1, cycles: 6, mode: 'implied' },
    /* SBC 8 */
    0xE9: { inst: 'SBC', bytes: 2, cycles: 2, mode: 'immediate' },
    0xE5: { inst: 'SBC', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0xF5: { inst: 'SBC', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0xED: { inst: 'SBC', bytes: 3, cycles: 4, mode: 'absolute' },
    0xFD: { inst: 'SBC', bytes: 3, cycles: 4, mode: 'absoluteX', pageCrossing: 1 },
    0xF9: { inst: 'SBC', bytes: 3, cycles: 4, mode: 'absoluteY', pageCrossing: 1 },
    0xE1: { inst: 'SBC', bytes: 2, cycles: 6, mode: 'indirectX' },
    0xF1: { inst: 'SBC', bytes: 2, cycles: 5, mode: 'indirect_Y' },
    /* SEC 1 */
    0x38: { inst: 'SEC', bytes: 1, cycles: 2, mode: 'implied' },
    /* SED 1 */
    0xF8: { inst: 'SED', bytes: 1, cycles: 2, mode: 'implied' },
    /* SEI 1 */
    0x78: { inst: 'SEI', bytes: 1, cycles: 2, mode: 'implied' },
    /* STA 7 */
    0x85: { inst: 'STA', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0x95: { inst: 'STA', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0x8D: { inst: 'STA', bytes: 3, cycles: 4, mode: 'absolute' },
    0x9D: { inst: 'STA', bytes: 3, cycles: 5, mode: 'absoluteX' },
    0x99: { inst: 'STA', bytes: 3, cycles: 5, mode: 'absoluteY' },
    0x81: { inst: 'STA', bytes: 2, cycles: 6, mode: 'indirectX' },
    0x91: { inst: 'STA', bytes: 2, cycles: 6, mode: 'indirect_Y' },
    /* STX 3 */
    0x86: { inst: 'STX', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0x96: { inst: 'STX', bytes: 2, cycles: 4, mode: 'zeroPageY' },
    0x8E: { inst: 'STX', bytes: 3, cycles: 4, mode: 'absolute' },
    /* STY 3 */
    0x84: { inst: 'STY', bytes: 2, cycles: 3, mode: 'zeroPage' },
    0x94: { inst: 'STY', bytes: 2, cycles: 4, mode: 'zeroPageX' },
    0x8C: { inst: 'STY', bytes: 3, cycles: 4, mode: 'absolute' },
    /* TAX 1 */
    0xAA: { inst: 'TAX', bytes: 1, cycles: 2, mode: 'implied'},
    /* TAY 1*/
    0xA8: { inst: 'TAY', bytes: 1, cycles: 2, mode: 'implied' },
    /* TSX 1 */
    0xBA: { inst: 'TSX', bytes: 1, cycles: 2, mode: 'implied' },
    /* TXA 1 */
    0x8A: { inst: 'TXA', bytes: 1, cycles: 2, mode: 'implied' },
    /* TXS 1 */
    0x9A: { inst: 'TXS', bytes: 1, cycles: 2, mode: 'implied' },
    /* TYA 1 */
    0x98: { inst: 'TYA', bytes: 1, cycles: 2, mode: 'implied' }
  }

  function pagesDiffer(a, b) {
    return a & 0xFF00 != b & 0xFF00;
  }

  const FRAME_IRQ = 0x4017;
  const CHANNELS = 0x4015;

  function writeMem(addr, v) {
    return CPU.MEM.write(addr, v);
    //CPU.MEM[addr] = v;
  }

  function readMem(addr) {
    return CPU.MEM.read(addr);
    //return CPU.MEM[addr];
  }

  const CPU = {
    MEM: null,
    reset: function() {
      REG_PC = Read16(0xFFFC);
      console.log('REG_PC: ' + REG_PC)
      REG_STA = 0x34;
      REG_ACC = REG_X = REG_Y = 0;
      REG_SP = 0xFD;
      writeMem(FRAME_IRQ, 0);
      writeMem(CHANNELS, 0);
    },
    powerUp: function() {
      this.reset();
    },
    triggerNMI: triggerNMI,
    //run: function(opcode) {
      //if (!ROM) {
        //throw new Error('没有ROM');
      //}
      //this.reset();
    //},
    cycle: function() {
      switch (interrupt) {
        case interruptNMI:
          REG_PC = NMI();
          break;
        case interruptIRQ:
          REG_PC = IRQ();
          break;
      }

      let opcode = Read(REG_PC);
      let inst = OpcodeSet[opcode];
      let operand;

      console.log(inst.inst + ' ' + opcode + ' ' + inst.mode);
      console.log('+++++++++++++++')
      if (inst.bytes === 1) {
        operand = null;
      } else if (inst.bytes === 2) {
        operand = Read(REG_PC + 1);
      } else {
        operand = Read16(REG_PC + 1);
      }

      REG_PC += inst.bytes;

      let value = Operand[inst.mode](operand)
      //if (value === undefined) {
        //throw new Error('operand: ' + operand + ' inst: ' + inst.inst + ' mode: ' + inst.mode)
      //}
      let newPC = InstructionAction[inst.inst](value, inst.mode);
      if (newPC !== undefined) {
        REG_PC = newPC;
      } 

      console.log('X: ' + REG_X)
      console.log('SP: ' + REG_SP)
      console.log('Y: ' + REG_Y)
      console.log('PC: ' + REG_PC)
      console.log('ACC: ' + REG_ACC)
      detachStatus();
      console.log('STATUS: ' + REG_STA)

      if (pageCrossed) {
        cycleCount += inst.pageCrossing;
      }
      pageCrossed = false;

      if (inst.mode === 'relative') {
        if (inSamePage) {
          cycleCount += inst.samePage;
        } else {
          cycleCount += inst.differentPage;
        }
      }

      cycleCount += inst.cycles;
      cycleCount += InterruptSet[interrupt].cycles;
      console.log('======================')

      return cycleCount;
    }
  }

  function Read(index) {
    //return this.ROM[index];
    return readMem(index);
  }
  function Read16(index) {
    //return this.ROM[index] | (this.ROM[index + 1] << 8);
    return readMem(index) | (readMem(index + 1) << 8);
  }

  function Read16bug(addr) {
    let a = addr;
    let b = (a & 0xFF00) | (a + 1);
    let lo = Read(a);
    let hi = Read(b);
    return (hi << 8) | lo;
  }

  const Operand = {
    immediate: function(v) {
      curAddr = REG_PC + 1;
      return v;
    },
    zeroPage: function(v) {
      curAddr = v;
      return readMem(v);
    },
    zeroPageX: function(v) {
      let addr = (v + REG_X) & 0xFF;
      curAddr = addr;
      return readMem(addr);
    },
    zeroPageY: function(v) {
      let addr = (v + REG_Y) & 0xFF;
      curAddr = addr;
      return readMem(addr);
    },
    absolute: function(v) {
      curAddr = v;
      console.log(curAddr)
      return Read16(v);
    },
    absoluteX: function(v) {
      let addr = (v + REG_X) & 0xFFFF;
      curAddr = addr;
      pageCrossed = pagesDiffer(addr - REG_X, addr);
      return readMem(addr);
    },
    absoluteY: function(v) {
      let addr = (v + REG_Y) & 0xFFFF;
      curAddr = addr;
      pageCrossed = pagesDiffer(addr - REG_Y, addr);
      return readMem(addr);
    },
    indirect: function(v) {
      let addr = Read16bug(v);
      curAddr = addr;
      return readMem(addr);
    },
    indirectX: function(v) {
      let addr = Read16bug(v + REG_X);
      curAddr = addr;
      return readMem(addr);
    },
    indirect_Y: function(v) {
      let addr = Read16bug(v) + REG_Y;
      curAddr = addr;
      pageCrossed = pagesDiffer(addr - REG_Y, addr);
      return readMem(addr);
    },
    relative: function(v) {
      //let offset = (v & 0x80) >> 7 ? -(v & 0x7F) : v & 0x7F;
      //// REG_PC += val;
      //curAddr = null;
      //let addr = offset + REG_PC
      if (v < 0x80) {
        addr = REG_PC + 2 + v;
      } else {
        addr = REG_PC + 2 + v - 0x100;
      }
      curAddr = addr;
      inSamePage = pagesDiffer(REG_PC, addr);
      return addr;
    },
    accumulator: function(v) {
      return REG_ACC;
    },
    implied: function(v) {
      return null;
    }
  }

  /*
   * Decremented every time a byte is pushed onto the stack, and incremented when a byte is popped off the stack.
   */

  return CPU;
}

