import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FloatingNav } from '../floating-nav/floating-nav';

@Component({
  selector: 'app-authenticated-layout',
  imports: [RouterOutlet, FloatingNav],
  templateUrl: './authenticated-layout.html',
  styleUrl: './authenticated-layout.scss',
})
export class AuthenticatedLayout {

}
