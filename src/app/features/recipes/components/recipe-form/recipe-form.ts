import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { IconComponent } from '../../../../shared/components/icon/icon';
import { CapitalizeFirstLetterDirective } from '../../../../shared/directives/capitalize-first-letter.directive';
import { Recipe, RecipeImage } from '../../../../core/models/recipe.model';
import {
  RECIPE_CATEGORIES,
  getRecipeCategoryLabel,
  normalizeRecipeCategoryValue,
} from '../../../../core/constants/recipe-categories';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_BYTES } from '../../../../core/constants/image-upload';
import {
  RecipeFormIngredientValue,
  RecipeFormStepValue,
  RecipeFormSubmitValue,
} from './recipe-form.model';
import { PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-recipe-form',
  imports: [ReactiveFormsModule, DragDropModule, IconComponent, CapitalizeFirstLetterDirective],
  templateUrl: './recipe-form.html',
  styleUrl: './recipe-form.scss',
})
export class RecipeFormComponent {
  private fb = inject(FormBuilder);
  private elementRef = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private formActionsRef = viewChild<ElementRef<HTMLElement>>('formActions');

  mode = input<'create' | 'edit'>('create');
  saving = input(false);
  submitError = input<string | null>(null);
  initialRecipe = input<Recipe | null>(null);

  submitted = output<RecipeFormSubmitValue>();
  cancelled = output<void>();

  categories = RECIPE_CATEGORIES;
  ingredientUnits = ['gr', 'kg', 'ml', 'cda', 'cdta', 'taza', 'unidad(s)'];
  tagSuggestions = ['rapida', 'facil', 'casera', 'saludable', 'vegetariana', 'picante'];

  selectedImageFile: File | null = null;
  existingImage: RecipeImage | null = null;
  imagePreviewUrl: string | null = null;
  imageError = '';
  imageDragActive = signal(false);
  categoryDropdownOpen = signal(false);
  ingredientUnitDropdownIndex = signal<number | null>(null);
  localSubmitError = signal<string | null>(null);
  formActionsVisible = signal(false);

  private objectPreviewUrl: string | null = null;
  private syncedRecipeId: string | null = null;
  private imageDragDepth = 0;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    notes: [''],
    servings: [null as number | null],
    prepTimeMinutes: [null as number | null],
    cookTimeMinutes: [null as number | null],
    category: [''],
    tags: this.fb.nonNullable.control<string[]>([]),
    ingredients: this.fb.array([this.createIngredientGroup()]),
    steps: this.fb.array([this.createStepGroup()]),
  });

  constructor() {
    effect(() => {
      const recipe = this.initialRecipe();

      if (!recipe) {
        return;
      }

      if (this.syncedRecipeId === recipe.id) {
        return;
      }

      this.populateForm(recipe);
      this.syncedRecipeId = recipe.id;
    });

    effect((onCleanup) => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const actionsElement = this.formActionsRef()?.nativeElement;

      if (!actionsElement) {
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          this.formActionsVisible.set(entry?.isIntersecting ?? false);
        },
        {
          threshold: 0.15,
        },
      );

      observer.observe(actionsElement);
      onCleanup(() => observer.disconnect());
    });

    this.destroyRef.onDestroy(() => {
      this.formActionsVisible.set(false);
    });
  }

  get ingredients(): FormArray {
    return this.form.get('ingredients') as FormArray;
  }

  get steps(): FormArray {
    return this.form.get('steps') as FormArray;
  }

  formTitle(): string {
    return this.mode() === 'edit' ? 'Editar receta' : 'Nueva receta';
  }

  formSubtitle(): string {
    return this.mode() === 'edit'
      ? 'Actualiza la receta y guarda los cambios.'
      : 'Crea una receta básica para empezar.';
  }

  submitLabel(): string {
    if (this.saving()) {
      return this.mode() === 'edit' ? 'Guardando cambios...' : 'Guardando...';
    }

    return this.mode() === 'edit' ? 'Guardar cambios' : 'Guardar receta';
  }

  displayedSubmitError(): string | null {
    return this.submitError() ?? this.localSubmitError();
  }

  addIngredient(): void {
    this.ingredients.push(this.createIngredientGroup());
    this.focusLastIngredient();
  }

  removeIngredient(index: number): void {
    if (this.ingredients.length === 1) {
      return;
    }

    this.ingredients.removeAt(index);
    if (this.ingredientUnitDropdownIndex() === index) {
      this.ingredientUnitDropdownIndex.set(null);
    }
  }

  addStep(): void {
    this.steps.push(this.createStepGroup());
    this.focusLastStep();
  }

  removeStep(index: number): void {
    if (this.steps.length === 1) {
      return;
    }

    this.steps.removeAt(index);
  }

  dropStep(event: CdkDragDrop<AbstractControl[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    this.moveStep(event.previousIndex, event.currentIndex);
  }

  trackByControlId(index: number, control: AbstractControl): string | number {
    return control.get('id')?.value ?? index;
  }

  createIngredientGroup(value?: Partial<RecipeFormIngredientValue>) {
    return this.fb.group({
      id: [value?.id ?? crypto.randomUUID()],
      name: [value?.name ?? '', Validators.required],
      quantity: [value?.quantity ?? null],
      unit: [value?.unit ?? ''],
      notes: [value?.notes ?? ''],
    });
  }

  createStepGroup(value?: Partial<RecipeFormStepValue>) {
    return this.fb.group({
      id: [value?.id ?? crypto.randomUUID()],
      instruction: [value?.instruction ?? '', Validators.required],
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!this.processSelectedImage(file)) {
      input.value = '';
    }
  }

  onImageDragEnter(event: DragEvent): void {
    if (!this.hasDraggedImage(event)) {
      return;
    }

    event.preventDefault();
    this.imageDragDepth += 1;
    this.imageDragActive.set(true);
  }

  onImageDragOver(event: DragEvent): void {
    if (!this.hasDraggedImage(event)) {
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    this.imageDragActive.set(true);
  }

  onImageDragLeave(event: DragEvent): void {
    if (!this.hasDraggedImage(event)) {
      return;
    }

    event.preventDefault();
    this.imageDragDepth = Math.max(0, this.imageDragDepth - 1);

    if (this.imageDragDepth === 0) {
      this.imageDragActive.set(false);
    }
  }

  onImageDropped(event: DragEvent): void {
    if (!this.hasDraggedImage(event)) {
      return;
    }

    event.preventDefault();
    this.imageDragDepth = 0;
    this.imageDragActive.set(false);

    const file = event.dataTransfer?.files?.[0] ?? null;

    if (!file) {
      return;
    }

    this.processSelectedImage(file);
  }

  removeSelectedImage(): void {
    this.clearObjectPreview();
    this.selectedImageFile = null;
    this.existingImage = null;
    this.imagePreviewUrl = null;
    this.imageError = '';
  }

  selectedImageLabel(): string {
    if (this.selectedImageFile) {
      return this.selectedImageFile.name;
    }

    return this.mode() === 'edit' ? 'Imagen actual de la receta' : 'Vista previa de la receta';
  }

  toggleCategoryDropdown(): void {
    this.ingredientUnitDropdownIndex.set(null);
    this.categoryDropdownOpen.update((value) => !value);
  }

  selectCategory(value: string): void {
    this.form.controls.category.setValue(value);
    this.categoryDropdownOpen.set(false);
  }

  toggleIngredientUnitDropdown(index: number): void {
    this.categoryDropdownOpen.set(false);
    this.ingredientUnitDropdownIndex.update((currentIndex) =>
      currentIndex === index ? null : index,
    );
  }

  selectIngredientUnit(index: number, unit: string): void {
    const ingredient = this.ingredients.at(index);
    ingredient.get('unit')?.setValue(unit);
    this.ingredientUnitDropdownIndex.set(null);
  }

  selectedIngredientUnitLabel(index: number): string {
    return this.ingredients.at(index).get('unit')?.value || 'Unidad';
  }

  selectedCategoryLabel(): string {
    const selectedValue = this.form.controls.category.value;

    return getRecipeCategoryLabel(selectedValue) ?? 'Selecciona una categoría';
  }

  addTag(value: string): void {
    const normalizedTag = this.normalizeTag(value);

    if (!normalizedTag) {
      return;
    }

    const currentTags = this.form.controls.tags.value;

    if (currentTags.includes(normalizedTag)) {
      return;
    }

    this.form.controls.tags.setValue([...currentTags, normalizedTag]);
    this.form.controls.tags.markAsDirty();
    this.form.controls.tags.markAsTouched();
  }

  addTagFromInput(input: HTMLInputElement): void {
    this.addTag(input.value);
    input.value = '';
  }

  removeTag(tagToRemove: string): void {
    this.form.controls.tags.setValue(
      this.form.controls.tags.value.filter((tag) => tag !== tagToRemove),
    );
    this.form.controls.tags.markAsDirty();
    this.form.controls.tags.markAsTouched();
  }

  handleTagKeydown(event: KeyboardEvent, input: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTagFromInput(input);
      return;
    }

    if (event.key === 'Backspace' && !input.value.trim()) {
      const tags = this.form.controls.tags.value;

      if (!tags.length) {
        return;
      }

      event.preventDefault();
      this.removeTag(tags[tags.length - 1]);
    }
  }

  availableTagSuggestions(): string[] {
    const selectedTags = new Set(this.form.controls.tags.value);

    return this.tagSuggestions.filter((tag) => !selectedTags.has(tag));
  }

  handleSubmit(): void {
    this.localSubmitError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.scrollToFirstInvalidField();
      this.localSubmitError.set('Revisa los campos obligatorios antes de guardar la receta.');
      return;
    }

    const value = this.form.getRawValue();

    this.submitted.emit({
      title: value.title ?? '',
      description: value.description ?? '',
      notes: value.notes ?? '',
      servings: value.servings ?? null,
      prepTimeMinutes: value.prepTimeMinutes ?? null,
      cookTimeMinutes: value.cookTimeMinutes ?? null,
      category: normalizeRecipeCategoryValue(value.category ?? ''),
      tags: value.tags ?? [],
      ingredients:
        value.ingredients?.map((ingredient) => ({
          id: ingredient.id ?? crypto.randomUUID(),
          name: ingredient.name ?? '',
          quantity: ingredient.quantity?.trim() ? ingredient.quantity.trim() : null,
          unit: ingredient.unit ?? '',
          notes: ingredient.notes ?? '',
        })) ?? [],
      steps:
        value.steps?.map((step) => ({
          id: step.id ?? crypto.randomUUID(),
          instruction: step.instruction ?? '',
        })) ?? [],
      selectedImageFile: this.selectedImageFile,
      existingImage: this.existingImage,
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (!this.isClickInsideDropdown(target, '.recipe-form-category-dropdown')) {
      this.categoryDropdownOpen.set(false);
    }

    if (!this.isClickInsideDropdown(target, '.recipe-form-unit-dropdown')) {
      this.ingredientUnitDropdownIndex.set(null);
    }
  }

  private populateForm(recipe: Recipe): void {
    this.clearObjectPreview();
    this.form.reset({
      title: recipe.title,
      description: recipe.description ?? '',
      notes: recipe.notes ?? '',
      servings: recipe.servings ?? null,
      prepTimeMinutes: recipe.prepTimeMinutes ?? null,
      cookTimeMinutes: recipe.cookTimeMinutes ?? null,
      category: normalizeRecipeCategoryValue(recipe.category ?? ''),
      tags: recipe.tags ?? [],
    });

    this.replaceIngredients(recipe.ingredients);
    this.replaceSteps(recipe.steps);
    this.existingImage = recipe.image ?? null;
    this.selectedImageFile = null;
    this.imagePreviewUrl = recipe.image?.url ?? null;
    this.imageError = '';
  }

  private replaceIngredients(ingredients: Recipe['ingredients']): void {
    this.ingredients.clear();

    if (!ingredients.length) {
      this.ingredients.push(this.createIngredientGroup());
      return;
    }

    for (const ingredient of ingredients) {
      this.ingredients.push(this.createIngredientGroup(ingredient));
    }
  }

  private replaceSteps(steps: Recipe['steps']): void {
    this.steps.clear();

    if (!steps.length) {
      this.steps.push(this.createStepGroup());
      return;
    }

    for (const step of steps) {
      this.steps.push(this.createStepGroup(step));
    }
  }

  private moveStep(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) {
      return;
    }

    const control = this.steps.at(fromIndex);

    if (!control) {
      return;
    }

    this.steps.removeAt(fromIndex);
    this.steps.insert(toIndex, control);
    this.steps.markAsDirty();
    this.steps.markAsTouched();
  }

  private normalizeTag(value: string): string {
    return value.trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase();
  }

  private isClickInsideDropdown(target: HTMLElement | null, selector: string): boolean {
    if (!target) {
      return false;
    }

    return Boolean(target.closest(selector));
  }

  private hasDraggedImage(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;

    return Boolean(types && Array.from(types).includes('Files'));
  }

  private processSelectedImage(file: File): boolean {
    this.imageError = '';

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.imageError = 'Formato no permitido. Usa JPG, PNG o WebP.';
      return false;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.imageError = 'La imagen supera el tamaño máximo de 10 MB.';
      return false;
    }

    this.clearObjectPreview();
    this.selectedImageFile = file;
    this.existingImage = null;
    this.objectPreviewUrl = URL.createObjectURL(file);
    this.imagePreviewUrl = this.objectPreviewUrl;
    return true;
  }

  private scrollToFirstInvalidField(): void {
    const invalidField = this.elementRef.nativeElement.querySelector(
      'input.ng-invalid, textarea.ng-invalid, select.ng-invalid',
    ) as HTMLElement | null;

    invalidField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    invalidField?.focus();
  }

  private focusLastStep(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const stepTextareas = this.elementRef.nativeElement.querySelectorAll(
          '[formarrayname="steps"] textarea[formcontrolname="instruction"]',
        );
        const lastStepTextarea = stepTextareas.item(
          stepTextareas.length - 1,
        ) as HTMLTextAreaElement | null;

        lastStepTextarea?.focus();
        lastStepTextarea?.setSelectionRange(
          lastStepTextarea.value.length,
          lastStepTextarea.value.length,
        );
      });
    });
  }

  private focusLastIngredient(): void {
    queueMicrotask(() => {
      const ingredientGroups = this.elementRef.nativeElement.querySelectorAll(
        '[formarrayname="ingredients"] [formgroupname]',
      );
      const lastIngredientGroup = ingredientGroups.item(
        ingredientGroups.length - 1,
      ) as HTMLElement | null;
      const firstInput = lastIngredientGroup?.querySelector(
        'input[formcontrolname="name"]',
      ) as HTMLInputElement | null;

      // lastIngredientGroup?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInput?.focus();
    });
  }

  private clearObjectPreview(): void {
    if (this.objectPreviewUrl) {
      URL.revokeObjectURL(this.objectPreviewUrl);
      this.objectPreviewUrl = null;
    }
  }
}
