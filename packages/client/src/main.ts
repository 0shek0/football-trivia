import '@fontsource-variable/fredoka/wght.css';
import '@fontsource-variable/baloo-bhaijaan-2/wght.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
