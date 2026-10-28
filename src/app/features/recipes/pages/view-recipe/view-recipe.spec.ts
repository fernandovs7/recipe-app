import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { RecipeService } from '../../services/recipe.service';
import { ViewRecipe } from './view-recipe';

describe('ViewRecipe', () => {
  let component: ViewRecipe;
  let fixture: ComponentFixture<ViewRecipe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewRecipe],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 'missing-recipe' }) },
          },
        },
        {
          provide: RecipeService,
          useValue: {
            getRecipeById: vi.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewRecipe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create and report a missing recipe', () => {
    expect(component).toBeTruthy();
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('La receta no existe o no tienes acceso.');
  });
});
