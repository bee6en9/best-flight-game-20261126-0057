// Ember Isle Run — keyboard + mouse input. Keys are the primary controls;
// the mouse drags the chase camera a little and clicks the menu buttons.
// Nothing here knows about the flight model: it only reports intent.

export function createInput() {
  const keys = new Set();
  const input = {
    keys,
    // Mouse orbit offset for the chase camera, eased back to zero.
    mouseYaw: 0,
    mousePitch: 0,
    dragging: false,
    // One-shot actions consumed by the game loop.
    pressed: new Set(),
    paused: false,
  };

  const KEYMAP = {
    ArrowUp: 'pitchDown', KeyW: 'throttleUp',
    ArrowDown: 'pitchUp', KeyS: 'throttleDown',
    ArrowLeft: 'rollLeft', KeyA: 'rollLeft',
    ArrowRight: 'rollRight', KeyD: 'rollRight',
    KeyQ: 'rudderLeft', KeyE: 'rudderRight',
  };

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'Enter') input.pressed.add('start');
    if (e.code === 'KeyR') input.pressed.add('restart');
    if (e.code === 'KeyG') input.pressed.add('gear');
    if (e.code === 'KeyC') input.pressed.add('camera');
    if (e.code === 'KeyM') input.pressed.add('mute');
    if (e.code === 'KeyP' || e.code === 'Escape') {
      input.pressed.add('pause');
      input.paused = !input.paused;
    }
    keys.add(e.code);
    if (KEYMAP[e.code] || e.code.startsWith('Arrow')) e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  let lastX = 0;
  let lastY = 0;
  function onMouseDown(e) {
    if (e.target.closest('button')) return; // let buttons handle their own clicks
    input.dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMouseMove(e) {
    if (!input.dragging) return;
    input.mouseYaw -= (e.clientX - lastX) * 0.0022;
    input.mousePitch += (e.clientY - lastY) * 0.0016;
    input.mouseYaw = Math.max(-0.6, Math.min(0.6, input.mouseYaw));
    input.mousePitch = Math.max(-0.25, Math.min(0.35, input.mousePitch));
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMouseUp() {
    input.dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // Read the current stick position from held keys (-1..1 each axis).
  input.readStick = function readStick() {
    // ArrowUp pushes the nose down, ArrowDown pulls it up (stick convention).
    const pitch =
      (keys.has('ArrowUp') ? -1 : 0) +
      (keys.has('ArrowDown') ? 1 : 0);
    const roll =
      (keys.has('ArrowLeft') || keys.has('KeyA') ? -1 : 0) +
      (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0);
    const throttleDelta =
      (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
    const rudder =
      (keys.has('KeyQ') ? -1 : 0) + (keys.has('KeyE') ? 1 : 0);
    return { pitch, roll, throttleDelta, rudder };
  };

  input.consume = function consume(name) {
    if (input.pressed.has(name)) {
      input.pressed.delete(name);
      return true;
    }
    return false;
  };

  input.dispose = function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
  return input;
}
