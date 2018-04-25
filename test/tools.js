class Ctrl {
  constructor(title) {
    this.title = title;
    this.subtitle = null;
  }
}

function describe(title, f) {
  const ctrl = new Ctrl(title);
  console.log(`{${title}}`);
  f.call(ctrl, it.bind(ctrl), expect.bind(ctrl));
}

function it(shouldbe, f) {
  const ctrl = this;
  console.log(`- it ${shouldbe}`);
  f();
}

function expect(value) {
  const ctrl = this;
  const notPass = '[Not Pass]';
  function genDes(r, v, value, expectValue) {
    const isOrNot = r ? 'is' : 'is not';
    const des = ` ${value} ${isOrNot} to ${v} ${expectValue} ` + (r ? '' : notPass);
    return des;
  }
  return {
    tobe: function(expectValue) {
      const r = value === expectValue;
      console.log(genDes(r, 'be', value, expectValue));
    },
    toequal: function(expectValue) {
      const r = value === expectValue;
      console.log(genDes(r, 'equal', value, expectValue));
    },

  }
}

export default describe;

