import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditRecipe } from './edit-recipe';

describe('EditRecipe', () => {
  let component: EditRecipe;
  let fixture: ComponentFixture<EditRecipe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditRecipe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditRecipe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
