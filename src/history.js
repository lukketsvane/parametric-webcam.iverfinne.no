export function createHistory(initial, limit = 60) {
  const capacity = Number.isFinite(limit) ? Math.max(2, Math.floor(limit)) : 60;
  const clone = value => structuredClone(value);
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let states = [clone(initial)];
  let cursor = 0;
  let grouping = false;
  let pending = null;
  const current = () => grouping ? pending : states[cursor];
  const commit = value => {
    states = states.slice(0, cursor + 1);
    states.push(clone(value));
    if (states.length > capacity) states.shift();
    cursor = states.length - 1;
  };
  const end = () => {
    if (!grouping) return;
    const value = pending;
    grouping = false;
    pending = null;
    if (!equal(value, states[cursor])) commit(value);
  };
  return {
    record(value) {
      if (equal(value, current())) return false;
      if (grouping) pending = clone(value);
      else commit(value);
      return true;
    },
    begin() {
      if (grouping) return;
      pending = clone(states[cursor]);
      grouping = true;
    },
    end,
    undo() {
      end();
      if (cursor === 0) return null;
      return clone(states[--cursor]);
    },
    redo() {
      end();
      if (cursor === states.length - 1) return null;
      return clone(states[++cursor]);
    },
    get canUndo() {
      return cursor > 0 || grouping && !equal(pending, states[cursor]);
    },
    get canRedo() {
      return cursor < states.length - 1 && (!grouping || equal(pending, states[cursor]));
    }
  };
}
