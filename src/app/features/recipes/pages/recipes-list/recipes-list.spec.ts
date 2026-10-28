import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Recipe } from '../../../../core/models/recipe.model';
import { RecipeService } from '../../services/recipe.service';
import { RecipesList } from './recipes-list';

const RECIPES: Recipe[] = [
  {
    id: 'recipe-1',
    userId: 'user-1',
    title: 'Sopa de tomate',
    description: 'Una sopa casera',
    ingredients: [],
    steps: [],
    servings: 2,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    category: 'sopas',
    tags: ['rápida'],
    favorite: true,
    createdAt: 2,
    updatedAt: 2,
  },
  {
    id: 'recipe-2',
    userId: 'user-1',
    title: 'Ensalada verde',
    ingredients: [],
    steps: [],
    servings: 1,
    prepTimeMinutes: 5,
    cookTimeMinutes: null,
    category: 'ensaladas',
    tags: ['saludable'],
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('RecipesList', () => {
  let component: RecipesList;
  let fixture: ComponentFixture<RecipesList>;
  const recipes = signal<Recipe[]>(RECIPES);

  beforeEach(async () => {
    recipes.set(RECIPES);
    await TestBed.configureTestingModule({
      imports: [RecipesList],
      providers: [
        provideRouter([]),
        {
          provide: RecipeService,
          useValue: {
            recipes,
            loading: signal(false),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipesList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should expose recipe and favorite totals', () => {
    expect(component.totalRecipes()).toBe(2);
    expect(component.totalFavorites()).toBe(1);
  });

  it('should filter recipes by search text', () => {
    component.searchTerm.set('tomate');
    expect(component.filteredRecipes().map((recipe) => recipe.id)).toEqual(['recipe-1']);
  });
});
