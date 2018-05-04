const InstructionMeaning = {
  ADC: 'Add memory to accumulator with carry',
  SBC: 'Subtract memory from accumulator with borrow',

  ASL: 'Shift left one bit (memory or accumulator)',
  LSR: 'Shift right one bit (memory or accumulator)',
  ROL: 'Rotate one bit left (memory or accumulator)',
  ROR: 'Rotate one bit right (memory or accumulator)',

  BCC: 'Branch on carry clear',
  BCS: 'Branch on carry set',
  BEQ: 'Branch on result zero',
  BMI: 'Branch on result minus',
  BNE: 'Branch on result not zero',
  BPL: 'Branch on result plus',
  BVC: 'Branch on overflow clear',
  BVS: 'Branch on overflow set',

  BIT: 'Test bits in memory with accumulator',

  BRK: 'Force Break',

  CLC: 'Clear carry flag',
  CLD: 'Clear decimal mode',
  CLI: 'Clear interrupt disable bit',
  CLV: 'Clear overflow flag',

  CPM: 'Compare memory and accumulator',
  CPX: 'Compare memory and index X',
  CPY: 'Compare memory and index Y',

  DEC: 'Decrement memory by one',
  DEX: 'Decrement index X by one',
  DEY: 'Decrement index Y by one',
  INC: 'Incerment memory by one',
  INX: 'Incerment index X by one',
  INY: 'Incerment index Y by one',

  EOR: 'Exclusive-Or memory with accumulator',
  AND: 'AND memory with accumulator',
  ORA: 'OR memory with accumulator',

  JMP: 'Jump to new location',
  JSR: 'Jump to new location saving return address',

  LDA: 'Load accumulator with memory',
  LDX: 'Load index X with memory',
  LDY: 'Load index Y with memory',

  NOP: 'No operation',

  PHA: 'Push accumulator on stack',
  PHP: 'Push processor status on stack',
  PLA: 'Pull accumulator from stack',
  PLP: 'Pull processor status from stack',

  RTI: 'Return from interrupt',
  RTS: 'Return from subroutine',

  SEC: 'Set carry flag',
  SED: 'Set decimal mode',
  SEI: 'Set Interrupt Disable Status',

  STA: 'Store accumulator in memory',
  STX: 'Store index X in memory',
  STY: 'Store index Y in memory',

  TAX: 'Transfer accumulator to index X',
  TAY: 'Transfer accumulator to index Y',
  TXA: 'Transfer index X to accumulator',
  TYA: 'Transfer index Y to accumulator'
  TSX: 'Transfer stack pointer to index X',
  TXS: 'Transfer index X to stack pointer',
}

