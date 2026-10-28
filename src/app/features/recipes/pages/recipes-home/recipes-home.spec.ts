import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Recipe } from '../../../../core/models/recipe.model';
import { AuthService } from '../../../../core/services/auth.service';
import { RecipeService } from '../../services/recipe.service';
import { RecipesHome } from './recipes-home';

const RECIPES: Recipe[] = [
  {
    id: 'older',
    userId: 'user-1',
    title: 'Receta anterior',
    ingredients: [],
    steps: [],
    servings: 2,
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    tags: [],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'newer',
    userId: 'user-1',
    title: 'Receta reciente',
    ingredients: [],
    steps: [],
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    tags: [],
    favorite: true,
    createdAt: 2,
    updatedAt: 2,
  },
];

describe('RecipesHome', () => {
  let component: RecipesHome;
  let fixture: ComponentFixture<RecipesHome>;
  const user = signal({
    uid: 'user-1',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    photoURL: null,
    accountTier: 'pro' as const,
  });
  const recipes = signal<Recipe[]>(RECIPES);

  beforeEach(async () => {
    recipes.set(RECIPES);
    await TestBed.configureTestingModule({
      imports: [RecipesHome],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user,
            logout: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RecipeService,
          useValue: {
            recipes,
            loading: signal(false),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipesHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should derive the first name and recipe totals', () => {
    expect(component.firstName()).toBe('Ada');
    expect(component.totalRecipes()).toBe(2);
    expect(component.totalFavorites()).toBe(1);
  });

  it('should order recent recipes from newest to oldest', () => {
    expect(component.recentRecipes().map((recipe) => recipe.id)).toEqual(['newer', 'older']);
  });
});
