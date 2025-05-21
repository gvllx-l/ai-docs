import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Documentação Inteligente',
    Svg: require('@site/static/img/undraw_artificial_intelligence.svg').default,
    description: (
      <>
        Utilize o poder da IA para criar, manter e melhorar sua documentação.
        Automatize tarefas repetitivas e mantenha seu conteúdo sempre atualizado.
      </>
    ),
  },
  {
    title: 'Experiência Moderna',
    Svg: require('@site/static/img/undraw_design_thinking.svg').default,
    description: (
      <>
        Interface moderna e responsiva, com temas claro e escuro, busca integrada
        e navegação intuitiva para a melhor experiência do usuário.
      </>
    ),
  },
  {
    title: 'Integração Contínua',
    Svg: require('@site/static/img/undraw_version_control.svg').default,
    description: (
      <>
        Integre facilmente com seu fluxo de trabalho existente. Suporte nativo
        para GitHub, controle de versão e deploy automático.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="feature-card">
        <div className="text--center">
          <Svg className={styles.featureSvg} role="img" />
        </div>
        <div className="text--center padding-horiz--md">
          <Heading as="h3" className="feature-title">{title}</Heading>
          <p className="feature-description">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
