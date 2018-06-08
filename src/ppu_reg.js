const newPPUReg = (function() {
  /*** Register Class ***/
  class Register {
    constructor(initValue) {
      this.v = initValue;
    }
    write(newV) {
      this.v = newV;
    }
    read() {
      return this.v;
    }
    readBit(head) {
      return this.readBits(head);
    }
    readBits(head, length) {
      let mask = 0;
      length = length ? length : 1;
      for (let i = head; i <= head + length; i++) {
        mask += Math.power(2, i);
      }
      return (this.v & mask) >> head;
    }
    setBits(head, length, value) {
      let mask = 0;
      length = length ? length : 1;
      for (let i = head; i <= head + length; i++) {
        mask += Math.power(2, i);
      }
      this.v = this.v & (~mask) | (value << head);
    }
    setBit(index) {
      let mask = Math.power(2, index);
      this.v |= mask;
    }
    resetBit(index) {
      let mask = ~Math.power(2, index);
      this.v &= mask;
    }
    inc() {
      this.v++;
    }
    add(value) {
      this.v += value;
    }
  }

  function newReg(methods) {
    methods = methods ? methods : {};
    return Object.assign(new Register(0), methods);
  }

  return newReg;
})();
