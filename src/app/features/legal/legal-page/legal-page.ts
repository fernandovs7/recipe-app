import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface LegalSection {
  heading: string;
  paragraphs: string[];
}

interface LegalDocument {
  eyebrow: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
}

const PRIVACY_DOCUMENT: LegalDocument = {
  eyebrow: 'Privacidad',
  title: 'Politica de privacidad',
  intro:
    'En Cocinario App valoramos tu privacidad. Esta politica explica que informacion se recopila cuando usas la aplicacion, como se utiliza y que opciones tienes sobre tus datos.',
  lastUpdated: '27 de marzo de 2026',
  sections: [
    {
      heading: 'Informacion que recopilamos',
      paragraphs: [
        'Cuando inicias sesion con Google, recibimos informacion basica de tu cuenta como tu nombre, correo electronico y foto de perfil. Tambien almacenamos las recetas, imagenes y notas que decidas guardar dentro de la aplicacion.',
        'Podemos registrar informacion tecnica minima necesaria para operar el servicio, como identificadores de sesion y eventos relacionados con autenticacion y almacenamiento.',
      ],
    },
    {
      heading: 'Como usamos la informacion',
      paragraphs: [
        'Usamos tus datos para autenticar tu cuenta, mostrar tu perfil, guardar tus recetas y permitirte administrar tu recetario personal desde distintos dispositivos.',
        'No vendemos tu informacion personal ni la compartimos con terceros para publicidad conductual.',
      ],
    },
    {
      heading: 'Servicios de terceros',
      paragraphs: [
        'Cocinario App utiliza proveedores externos para operar funciones esenciales del servicio, incluyendo autenticacion con Google y almacenamiento mediante Supabase. Estos proveedores pueden procesar datos segun sus propios terminos y politicas.',
      ],
    },
    {
      heading: 'Conservacion y eliminacion',
      paragraphs: [
        'Tus datos se conservan mientras mantengas activa tu cuenta o mientras sean necesarios para prestar el servicio. Si deseas solicitar la eliminacion de tu cuenta o de tus datos, puedes escribir a fernandovs7@gmail.com.',
      ],
    },
    {
      heading: 'Tus derechos',
      paragraphs: [
        'Puedes solicitar acceso, correccion o eliminacion de la informacion asociada a tu cuenta, sujeto a las limitaciones legales y tecnicas aplicables.',
      ],
    },
    {
      heading: 'Contacto',
      paragraphs: [
        'Si tienes preguntas sobre esta politica de privacidad, puedes contactarnos en fernandovs7@gmail.com.',
      ],
    },
  ],
};

const TERMS_DOCUMENT: LegalDocument = {
  eyebrow: 'Condiciones',
  title: 'Terminos del servicio',
  intro:
    'Estos terminos regulan el acceso y uso de Cocinario App. Al utilizar la aplicacion, aceptas estas condiciones.',
  lastUpdated: '27 de marzo de 2026',
  sections: [
    {
      heading: 'Uso del servicio',
      paragraphs: [
        'Cocinario App ofrece un espacio personal para guardar y organizar recetas. Te comprometes a usar el servicio de forma legal, responsable y sin afectar la experiencia de otros usuarios o la seguridad de la plataforma.',
      ],
    },
    {
      heading: 'Cuenta de usuario',
      paragraphs: [
        'Eres responsable de la actividad realizada desde tu cuenta. Debes mantener el acceso a tu cuenta de Google de manera segura y notificarnos si detectas un uso no autorizado.',
      ],
    },
    {
      heading: 'Contenido del usuario',
      paragraphs: [
        'Conservas la titularidad del contenido que subas, como recetas, imagenes, instrucciones y notas. Nos otorgas permiso limitado para alojar, procesar y mostrar ese contenido con el unico fin de operar la aplicacion.',
      ],
    },
    {
      heading: 'Disponibilidad y cambios',
      paragraphs: [
        'Podemos actualizar, modificar o interrumpir funciones del servicio cuando sea necesario para mantenimiento, seguridad o mejoras del producto. Haremos esfuerzos razonables para minimizar interrupciones.',
      ],
    },
    {
      heading: 'Limitacion de responsabilidad',
      paragraphs: [
        'Cocinario App se ofrece tal como esta. En la medida permitida por la ley, no garantizamos que el servicio este libre de errores o interrupciones permanentes. No seremos responsables por perdidas indirectas o incidentales derivadas del uso del servicio.',
      ],
    },
    {
      heading: 'Contacto',
      paragraphs: [
        'Si tienes preguntas sobre estos terminos, puedes escribir a fernandovs7@gmail.com.',
      ],
    },
  ],
};

@Component({
  selector: 'app-legal-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.scss',
})
export class LegalPage {
  private readonly route = inject(ActivatedRoute);

  protected readonly document: LegalDocument =
    this.route.snapshot.data['document'] === 'terms' ? TERMS_DOCUMENT : PRIVACY_DOCUMENT;
}
