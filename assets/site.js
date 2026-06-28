(function () {
    function getTranslations() {
        if (window.translations) return window.translations;
        try {
            return translations;
        } catch (_) {
            return null;
        }
    }

    function setActiveLanguageButton(lang) {
        document.querySelectorAll('[data-lang]').forEach(button => {
            const active = button.dataset.lang === lang;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    window.setLang = function setLang(lang) {
        const dict = getTranslations();
        if (!dict || !dict[lang]) return;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!Object.prototype.hasOwnProperty.call(dict[lang], key)) return;
            if (el.hasAttribute('data-i18n-html')) {
                el.innerHTML = dict[lang][key];
            } else {
                el.textContent = dict[lang][key];
            }
        });

        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
        document.documentElement.dataset.lang = lang;
        localStorage.setItem('vix-lang', lang);
        setActiveLanguageButton(lang);

        const activeDemo = document.querySelector('.demo-scenario.active');
        if (activeDemo && typeof window.switchDemo === 'function') {
            window.switchDemo(activeDemo.dataset.demo);
        }
    };

    function setupLanguageSwitch() {
        document.querySelectorAll('[data-lang]').forEach(button => {
            button.addEventListener('click', () => window.setLang(button.dataset.lang));
        });

        const saved = localStorage.getItem('vix-lang');
        if (saved === 'zh' || saved === 'en') {
            window.setLang(saved);
        } else {
            setActiveLanguageButton('zh');
        }
    }

    function setupMobileNav() {
        document.querySelectorAll('nav').forEach(nav => {
            const toggle = nav.querySelector('.nav-toggle');
            const navRight = nav.querySelector('.nav-right');
            if (!toggle || !navRight) return;

            const close = () => {
                nav.classList.remove('nav-open');
                toggle.setAttribute('aria-expanded', 'false');
            };

            toggle.addEventListener('click', () => {
                const open = !nav.classList.contains('nav-open');
                nav.classList.toggle('nav-open', open);
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });

            navRight.querySelectorAll('a, button').forEach(item => {
                item.addEventListener('click', () => {
                    if (window.matchMedia('(max-width: 900px)').matches) close();
                });
            });

            document.addEventListener('keydown', event => {
                if (event.key === 'Escape') close();
            });

            window.addEventListener('resize', () => {
                if (!window.matchMedia('(max-width: 900px)').matches) close();
            }, { passive: true });
        });
    }

    function setupRevealAnimations() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        document.querySelectorAll('.reveal-grid').forEach(grid => {
            Array.from(grid.children).forEach((item, i) => {
                item.style.setProperty('--d', i * 0.1 + 's');
            });
        });

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }

    function setupProgressBar() {
        const bar = document.getElementById('progress-bar');
        if (!bar || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const update = () => {
            const st = window.scrollY || document.documentElement.scrollTop;
            const sh = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            bar.style.width = sh > 0 ? (st / sh * 100) + '%' : '0';
        };

        update();
        window.addEventListener('scroll', update, { passive: true });
    }

    function setupPointerGlow() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        document.addEventListener('mousemove', e => {
            const x = (e.clientX / window.innerWidth) * 100;
            const y = (e.clientY / window.innerHeight) * 100;
            document.documentElement.style.setProperty('--mx', x + '%');
            document.documentElement.style.setProperty('--my', y + '%');
        }, { passive: true });
    }

    function enhanceDemoTransitions() {
        if (typeof window.switchDemo !== 'function') return;

        const originalSwitch = window.switchDemo;
        window.switchDemo = function (key) {
            originalSwitch(key);
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            document.querySelectorAll('.demo-panel').forEach(panel => {
                panel.style.animation = 'none';
                void panel.offsetHeight;
                const keyframes = panel.classList.contains('before-panel') ? 'slideFromLeft' : 'slideFromRight';
                panel.style.animation = keyframes + ' 0.35s ease both';
            });
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupLanguageSwitch();
        setupMobileNav();
        setupRevealAnimations();
        setupProgressBar();
        setupPointerGlow();
        enhanceDemoTransitions();
    });
})();
