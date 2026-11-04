// A tiny helper for building pages. All text goes in as text nodes, never as HTML, so a player
// called "<script>" is just an unusual name and cannot run code.

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyAttributes(element, attributes) {
  for (const [key, value] of Object.entries(attributes || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      element.setAttribute('class', value);
    } else if (key === 'style' && typeof value === 'object') {
      for (const [property, styleValue] of Object.entries(value)) element.style.setProperty(property, styleValue);
    } else if (key === 'value' || key === 'checked' || key === 'selected' || key === 'disabled') {
      element[key] = value;
    } else {
      element.setAttribute(key, value === true ? '' : value);
    }
  }
}

function appendChildren(element, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** h('p', { class: 'hint' }, 'Hello') makes <p class="hint">Hello</p>. */
export function h(tag, attributes, ...children) {
  const element = document.createElement(tag);
  applyAttributes(element, attributes);
  appendChildren(element, children);
  return element;
}

export function svg(tag, attributes, ...children) {
  const element = document.createElementNS(SVG_NS, tag);
  applyAttributes(element, attributes);
  appendChildren(element, children);
  return element;
}

/** Links to another page in the app. Works from any folder, which GitHub Pages needs. */
export const route = (path) => `#${path}`;
