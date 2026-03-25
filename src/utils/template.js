function fillTemplate(str, vars = {}) {
  return String(str || '').replace(/{{\s*(\w+)\s*}}/g, (_, key) => (vars[key] ?? ''));
}

module.exports = { fillTemplate };
