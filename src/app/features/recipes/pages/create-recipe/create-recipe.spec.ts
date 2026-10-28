import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { RecipeImportService } from '../../services/recipe-import.service';
import { RecipeService } from '../../services/recipe.service';
import { CreateRecipe } from './create-recipe';

describe('CreateRecipe', () => {
  let component: CreateRecipe;
  let fixture: ComponentFixture<CreateRecipe>;

  beforeEach(async () => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        readonly root = null;
        readonly rootMargin = '0px';
        readonly thresholds = [0];

        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      },
    );

    await TestBed.configureTestingModule({
      imports: [CreateRecipe],
      providers: [
        provideRouter([]),
        {
          provide: RecipeService,
          useValue: {
            createRecipe: vi.fn().mockResolvedValue(undefined),
            uploadRecipeImageVariants: vi.fn(),
            deleteRecipeImage: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            user: signal(null),
          },
        },
        {
          provide: RecipeImportService,
          useValue: {
            importRecipeFromImage: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateRecipe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create the recipe form page', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-recipe-form')).toBeTruthy();
  });
});
