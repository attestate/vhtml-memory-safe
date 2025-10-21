import emptyTags from './empty-tags';
import { LRUCache } from 'lru-cache';

// escape an attribute
let esc = str => String(str).replace(/[&<>"']/g, s=>`&${map[s]};`);
let map = {'&':'amp','<':'lt','>':'gt','"':'quot',"'":'apos'};
let setInnerHTMLAttr = 'dangerouslySetInnerHTML';
let DOMAttributeNames = {
	className: 'class',
	htmlFor: 'for'
};

// Use LRU cache to prevent unbounded memory growth
// Based on heap analysis: ~5,400 strings per feed, 15s regeneration cycle
// 10,000 max = ~2 feeds worth (allows cache hits during regeneration)
// Strings are ~32 bytes each, so 10,000 entries = ~320 KB
let sanitized = new LRUCache({
	max: 10000,
	maxSize: 5 * 1024 * 1024,  // 5 MB safety cap
	sizeCalculation: () => 1    // Count-based eviction (uniform string sizes)
});

/** Hyperscript reviver that constructs a sanitized HTML string. */
export default function h(name, attrs) {
	let stack=[], s = '';
	attrs = attrs || {};
	for (let i=arguments.length; i-- > 2; ) {
		stack.push(arguments[i]);
	}

	// Sortof component support!
	if (typeof name==='function') {
		attrs.children = stack.reverse();
		return name(attrs);
		// return name(attrs, stack.reverse());
	}

	if (name) {
		s += '<' + name;
		if (attrs) for (let i in attrs) {
			if (attrs[i]!==false && attrs[i]!=null && i !== setInnerHTMLAttr) {
				s += ` ${DOMAttributeNames[i] ? DOMAttributeNames[i] : esc(i)}="${esc(attrs[i])}"`;
			}
		}
		s += '>';
	}

	if (emptyTags.indexOf(name) === -1) {
		if (attrs[setInnerHTMLAttr]) {
			s += attrs[setInnerHTMLAttr].__html;
		}
		else while (stack.length) {
			let child = stack.pop();
			if (child) {
				if (child.pop) {
					for (let i=child.length; i--; ) stack.push(child[i]);
				}
				else {
					s += sanitized.has(child) ? child : esc(child);
				}
			}
		}

		s += name ? `</${name}>` : '';
	}

	sanitized.set(s, true);
	return s;
}
