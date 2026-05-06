module.exports = new Proxy(
  {},
  {
    get: (_target, property) => String(property),
  },
);
