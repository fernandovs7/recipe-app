import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseRecipeStepText } from '../../utils/recipe-step-format';

@Component({
  selector: 'app-recipe-step-text',
  template: `
    @for (line of lines(); track $index) {
      @for (run of line; track $index) {
        @if (run.bold) {
          <strong class="font-bold">{{ run.text }}</strong>
        } @else {
          <span>{{ run.text }}</span>
        }
      }
      @if (!$last) {
        <br />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeStepTextComponent {
  text = input.required<string>();
  lines = computed(() => parseRecipeStepText(this.text()));
}
