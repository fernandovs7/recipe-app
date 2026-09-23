import { FirebaseOptions, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { environment } from '../../environments/environment';

function resolveAuthDomain(): string {
  if (typeof window === 'undefined') {
    return environment.firebase.authDomain;
  }

  const host = window.location.hostname;

  if (host === 'cocinario.app' || host === 'www.cocinario.app') {
    return host;
  }

  return environment.firebase.authDomain;
}

if (!environment.firebase.apiKey || !environment.firebase.appId) {
  throw new Error(
    'Missing Firebase web config. Register a web app in project recipe-app-a7be0 and fill src/environments/environment.ts.',
  );
}

const firebaseOptions: FirebaseOptions = {
  apiKey: environment.firebase.apiKey,
  authDomain: resolveAuthDomain(),
  projectId: environment.firebase.projectId,
  storageBucket: environment.firebase.storageBucket,
  appId: environment.firebase.appId,
};

if (environment.firebase.messagingSenderId) {
  firebaseOptions.messagingSenderId = environment.firebase.messagingSenderId;
}

export const firebaseApp = initializeApp(firebaseOptions);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const recipeStorage = getStorage(firebaseApp);
