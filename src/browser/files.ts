import type { DisposableType } from '@wopjs/disposable';
import type { Writable } from '../base';
import type { LsTreeElement } from '../repository';
import type { TreeNode } from './tree';

import { noop } from '@wopjs/cast';
import { appendChild, detach, listen } from '@wopjs/dom';
import { $, clearElement } from './dom';
import { Scrollable, type ItemRenderer } from './scrollable';
import { Widget } from './widget';
import { i, ic } from './icon';
import { val, type ReadonlyVal } from 'value-enhancer';
import { styleMod } from './css';

type Item = TreeNode<LsTreeElement>;
type Template = {
  readonly $depth: HTMLSpanElement;
  readonly $arrow: HTMLSpanElement;
  readonly $arrowIcon: HTMLElement;
  readonly $filename: HTMLSpanElement;
  readonly $fileIcon: HTMLElement;
};

export class Files extends Widget implements ItemRenderer<Item, Template> {
  readonly $header: HTMLElement;
  readonly $container: HTMLElement;

  readonly scrollable: Scrollable<Item>;
  readonly selected$: ReadonlyVal<number | undefined>;

  override initialize(this: Writable<this>): void {
    this.$header = appendChild(this.parent, $('.files-header'));
    this.$header.textContent = 'Repository';

    this.$container = appendChild(this.parent, $('.files'));

    const items$ = this.root.git.fileList$;
    this.scrollable = this._register(new Scrollable({
      container: this.$container,
      itemHeight: 22,
      items$,
      renderer: this,
    }));
    const selected$ = this.selected$ = this._register(val());

    this._register(this.scrollable.onHover(index => {
      const item = items$.value.at(index);
      if (item && item.data.type === 'blob') {
        this.root.git.prefetch(item.data.file);
      }
    }));

    this._register(this.scrollable.onClick(index => {
      selected$.set(index);
      const item = items$.value.at(index);
      if (item) {
        if (item.collapsible) {
          this.root.git.toggle(item.data.file);
          this.scrollable.focus(index);
        } else if (item.data.type === 'blob') {
          window.dispatchEvent(new CustomEvent('editor.open', { detail: item.data.file }));
        }
      }
    }));

    const style = this._register(styleMod.derive('selected-file'));
    this._register(this.selected$.subscribe(selected => {
      let key: string | undefined;
      if (selected != null) {
        const item = items$.value.at(selected);
        key = item?.data.file;
      }
      style.set({
        [`:where(.file:has([data-key="${key}"]))`]: {
          background: 'var(--selected)',
          color: 'var(--accent)',
        }
      });
    }));

    this._register(listen(this.$container, 'keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const current = selected$.value;
        const next = current != null ? (e.key === 'ArrowDown' ? current + 1 : current - 1) : 0;
        if (next >= 0 && next < items$.value.length) {
          selected$.set(next);
          const item = items$.value.at(next);
          if (item?.data.type === 'blob') {
            window.dispatchEvent(new CustomEvent('editor.open', { detail: item.data.file }));
          }
          this.scrollable.focus(next);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const current = selected$.value;
        if (current != null) {
          const item = items$.value.at(current);
          if (item && item.collapsible) {
            this.root.git.toggle(item.data.file);
            this.scrollable.focus(current);
          }
        }
      }
    }));
  }

  override layout(): void {
  }

  renderTemplate(dom: HTMLDivElement): HTMLDivElement & Template {
    dom.className = 'file';
    const $depth = appendChild(dom, $('span.depth'));
    const $arrow = appendChild(dom, $('span.arrow'));
    const $arrowIcon = i('chevron-right');
    const $filename = appendChild(dom, $('span.filename'));
    const $fileIcon = i('file');
    return Object.assign(dom, { $depth, $arrow, $arrowIcon, $filename, $fileIcon });
  }

  renderItem({ $depth, $arrow, $arrowIcon, $filename, $fileIcon }: Template, item: Item): DisposableType<void> {
    $depth.style.paddingLeft = item.depth ? `${item.depth * 10}px` : '';

    if (item.collapsible) {
      $arrowIcon.className = ic(item.collapsed ? 'chevron-right' : 'chevron-down');
      $fileIcon.className = ic(item.collapsed ? 'folder' : 'folder-opened');
      appendChild($arrow, $arrowIcon);
    } else {
      $fileIcon.className = ic('file');
      detach($arrowIcon);
    }

    clearElement($filename);
    $filename.append($fileIcon, item.data.file.split('/').pop()!);
    $filename.title = item.data.file + (item.collapsible ? '/' : '');
    $filename.dataset.key = item.data.file;

    return noop;
  }

}
