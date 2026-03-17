import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: 'input[type="text"], textarea',
  standalone: true,
})
export class CapitalizeFirstLetterDirective {
  private elementRef = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);
  private ngControl = inject(NgControl, { optional: true });

  @HostListener('input')
  onInput(): void {
    const element = this.elementRef.nativeElement;
    const value = element.value;

    if (!value) {
      return;
    }

    const firstVisibleCharacterIndex = value.search(/\S/);

    if (firstVisibleCharacterIndex < 0) {
      return;
    }

    const firstCharacter = value.charAt(firstVisibleCharacterIndex);
    const capitalizedCharacter = firstCharacter.toUpperCase();

    if (firstCharacter === capitalizedCharacter) {
      return;
    }

    const formattedValue =
      value.slice(0, firstVisibleCharacterIndex) +
      capitalizedCharacter +
      value.slice(firstVisibleCharacterIndex + 1);

    const selectionStart = element.selectionStart;
    const selectionEnd = element.selectionEnd;

    element.value = formattedValue;
    this.ngControl?.control?.setValue(formattedValue, { emitEvent: false });

    if (selectionStart !== null && selectionEnd !== null) {
      element.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}
