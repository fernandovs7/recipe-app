import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewRecipe } from './view-recipe';

describe('ViewRecipe', () => {
  let component: ViewRecipe;
  let fixture: ComponentFixture<ViewRecipe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewRecipe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewRecipe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
