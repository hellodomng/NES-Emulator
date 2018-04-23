class Ctrl {
  constructor() {
    this.test = 1;
  }
}
function describe(title, f) {
  console.log('[' + title + ']');

  const ctrl = new Ctrl()
  f.call(ctrl, expect.bind(ctrl));
}

function it(shouldbe, f) {
  f();
}

function expect(value) {
  console.log(this)
  return {
    tobe: function(expectValue) {
      console.log(this)
      return value === expectValue
    },
    toequal: function(expectValue) {
      return value === expectValue
    },

  }
}

describe('title', function(expect) {
  it('should be 2', () => {
    expect(2).tobe(2);
  })
})
