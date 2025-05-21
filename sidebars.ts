import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 * - create an ordered group of docs
 * - render a sidebar for each doc of that group
 * - provide next/previous navigation
 *
 * The sidebars can be generated from the filesystem, or explicitly defined here.
 *
 * Create as many sidebars as you want.
 *
 * More info: https://docusaurus.io/docs/sidebar
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Conceitos',
      items: [
        'concepts/vector-databases',
        'concepts/embeddings',
        'concepts/chat-memory',
        'concepts/rag',
        'concepts/instructions',
        'concepts/tools',
        'concepts/frameworks',
      ],
    },
    {
      type: 'category',
      label: 'Guias',
      items: [
        'guides/memory-types',
        'guides/training-flow',
        'guides/integration',
      ],
    },
    {
      type: 'category',
      label: 'Tutoriais',
      items: [
        'tutorials/rag-application',
        'tutorials/rag-chat-application',
      ],
    },
    {
      type: 'category',
      label: 'Providers',
      items: [
        'providers/vector-databases',
        'providers/embedding-providers',
        'providers/memory-systems',
        'providers/llm-providers',
        // Adicione outros arquivos de providers aqui
      ],
    },
  ],
};

export default sidebars;
