import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import PhonePresentation from './components/PhonePresentation';
import './styles.css';
import './workflows.css';
import './navigation-cards.css';
import './chat-refinement.css';
import './visual-consistency.css';
const phonePresentation=new URLSearchParams(location.search).get('presentation')==='phone';
if(phonePresentation)document.documentElement.dataset.phonePresentation='true';
if(window.frameElement?.hasAttribute('data-phone-viewport'))document.documentElement.dataset.phoneViewport='true';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{phonePresentation?<PhonePresentation/>:<App/>}</React.StrictMode>);

import './knowledge-detail.css';
import './skill-conversation.css';
import './share-import-demo.css';

import './organize.css';

import './skill-detail.css';
import './phone-presentation.css';
