import { getAsset, getBlogPermalink, getPermalink } from './utils/permalinks';

export const headerData = {
  links: [
    { text: '글', href: getBlogPermalink() },
    { text: '태그', href: getPermalink('/tags') },
    { text: '소개', href: getPermalink('/about') },
  ],
  actions: [
    {
      text: 'GitHub',
      href: 'https://github.com/jaekwang97',
      target: '_blank',
      icon: 'tabler:brand-github',
    },
  ],
};

export const footerData = {
  links: [],
  secondaryLinks: [],
  socialLinks: [
    { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
    { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: 'https://github.com/jaekwang97' },
  ],
  footNote: `© ${new Date().getFullYear()} JAEKWANG97. Built with AstroWind.`,
};
