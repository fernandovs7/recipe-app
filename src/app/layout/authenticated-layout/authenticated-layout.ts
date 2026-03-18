import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FloatingNav } from '../floating-nav/floating-nav';
import { IconComponent } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-authenticated-layout',
  imports: [RouterOutlet, FloatingNav, IconComponent],
  templateUrl: './authenticated-layout.html',
  styleUrl: './authenticated-layout.scss',
})
export class AuthenticatedLayout {
  readonly currentYear = new Date().getFullYear();
}
