// NUBEAUX Travel - Main JavaScript
// Enhanced with sophisticated animations

document.addEventListener('DOMContentLoaded', function() {
  // ========================================
  // MOBILE MENU
  // ========================================

  const menuToggle = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const body = document.body;

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function() {
      mobileMenu.classList.toggle('active');
      menuToggle.classList.toggle('active');
      body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        menuToggle.classList.remove('active');
        body.style.overflow = '';
      });
    });
  }

  // ========================================
  // HEADER SCROLL EFFECT
  // ========================================

  const header = document.querySelector('.header');
  let lastScroll = 0;

  function handleScroll() {
    const currentScroll = window.scrollY;

    if (currentScroll > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // ========================================
  // SMOOTH SCROLL
  // ========================================

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // ========================================
  // INTERSECTION OBSERVER FOR ANIMATIONS
  // ========================================

  // Configuration
  const observerConfig = {
    threshold: 0.15,
    rootMargin: '0px 0px -80px 0px'
  };

  // Create observer
  const animateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-visible');

        // Handle stagger children
        if (entry.target.classList.contains('stagger-children')) {
          const children = entry.target.children;
          Array.from(children).forEach((child, index) => {
            child.style.transitionDelay = `${index * 0.1}s`;
          });
        }

        // Unobserve after animation
        animateObserver.unobserve(entry.target);
      }
    });
  }, observerConfig);

  // Select elements to animate
  const animateSelectors = [
    '.animate-on-scroll',
    '.animate-fade-left',
    '.animate-fade-right',
    '.animate-scale',
    '.stagger-children',
    '.image-reveal',
    '.split-text-line',
    '.animate-line'
  ];

  // Auto-add animation classes to common elements
  const autoAnimateSelectors = [
    '.destination-card',
    '.itinerary-card',
    '.stay-card',
    '.creator-card',
    '.value-card',
    '.boxed-grid-item',
    '.benefit-item',
    '.feature-strip-item',
    '.section-header',
    '.section-header-left',
    '.full-bleed-content',
    '.quote-section blockquote',
    '.split-content',
    '.stats-row'
  ];

  // Add animation classes to auto-animate elements
  autoAnimateSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach((el, index) => {
      if (!el.classList.contains('animate-on-scroll') &&
          !el.classList.contains('animate-fade-left') &&
          !el.classList.contains('animate-fade-right')) {
        el.classList.add('animate-on-scroll');

        // Stagger cards
        if (selector.includes('card') || selector.includes('item')) {
          el.style.transitionDelay = `${(index % 6) * 0.1}s`;
        }
      }
    });
  });

  // Observe all animated elements
  animateSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      animateObserver.observe(el);
    });
  });

  // ========================================
  // HERO ANIMATIONS
  // ========================================

  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    const heroElements = heroContent.querySelectorAll('.hero-label, .hero-title, .hero-subtitle, .btn');
    heroElements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(40px)';
      setTimeout(() => {
        el.style.transition = 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 400 + (i * 200));
    });
  }

  // Page hero animation
  const pageHeroContent = document.querySelector('.page-hero-content, .image-cta-content');
  if (pageHeroContent) {
    const elements = pageHeroContent.querySelectorAll('h1, h2, p, .btn, .hr-accent');
    elements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 300 + (i * 150));
    });
  }

  // ========================================
  // PARALLAX EFFECT
  // ========================================

  const parallaxElements = document.querySelectorAll('.hero-bg video, .hero-bg img, .parallax-bg');

  if (parallaxElements.length > 0) {
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = window.scrollY;

          parallaxElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const parentHeight = el.parentElement?.offsetHeight || window.innerHeight;

            if (rect.bottom > 0 && rect.top < window.innerHeight) {
              const speed = 0.3;
              const yPos = scrolled * speed;
              el.style.transform = `translateY(${yPos}px)`;
            }
          });

          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ========================================
  // TEXT REVEAL
  // ========================================

  const textRevealElements = document.querySelectorAll('.text-large, .text-reveal');
  const textObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('text-reveal-visible');
        textObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  textRevealElements.forEach(el => {
    if (!el.classList.contains('text-reveal')) {
      el.classList.add('text-reveal');
    }
    textObserver.observe(el);
  });

  // ========================================
  // COUNTER ANIMATION
  // ========================================

  const counters = document.querySelectorAll('.stat-number, .animate-counter[data-count]');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-count') || el.textContent.replace(/\D/g, ''));
        const duration = 2000;
        const start = 0;
        const startTime = performance.now();

        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Easing function
          const easeOutQuart = 1 - Math.pow(1 - progress, 4);
          const current = Math.floor(start + (target - start) * easeOutQuart);

          el.textContent = current.toLocaleString();

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            el.textContent = target.toLocaleString();
          }
        };

        requestAnimationFrame(animate);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => {
    counterObserver.observe(counter);
  });

  // ========================================
  // IMAGE HOVER EFFECTS
  // ========================================

  // Gallery grid hover
  document.querySelectorAll('.mosaic-grid > *, [style*="grid-template-columns: repeat(4"]').forEach(grid => {
    const items = grid.querySelectorAll ? grid.querySelectorAll('> *') : [grid];
    items.forEach(item => {
      const img = item.querySelector('img') || item;
      if (img.tagName === 'IMG') {
        img.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        item.addEventListener('mouseenter', () => {
          img.style.transform = 'scale(1.1)';
        });
        item.addEventListener('mouseleave', () => {
          img.style.transform = 'scale(1)';
        });
      }
    });
  });

  // ========================================
  // MAGNETIC BUTTONS
  // ========================================

  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
    });
  });

  // ========================================
  // SPLIT SECTION OBSERVER
  // ========================================

  const splitSections = document.querySelectorAll('.split-section');

  splitSections.forEach(section => {
    const image = section.querySelector('.split-image');
    const content = section.querySelector('.split-content');

    if (image) {
      image.classList.add('animate-fade-left');
      animateObserver.observe(image);
    }

    if (content) {
      content.classList.add('animate-fade-right');
      animateObserver.observe(content);
    }
  });

  // Reverse for alternating sections
  document.querySelectorAll('.split-section.reverse').forEach(section => {
    const image = section.querySelector('.split-image');
    const content = section.querySelector('.split-content');

    if (image) {
      image.classList.remove('animate-fade-left');
      image.classList.add('animate-fade-right');
    }

    if (content) {
      content.classList.remove('animate-fade-right');
      content.classList.add('animate-fade-left');
    }
  });

  // ========================================
  // HR LINE ANIMATION
  // ========================================

  document.querySelectorAll('.hr-accent').forEach(hr => {
    hr.classList.add('animate-line');
    animateObserver.observe(hr);
  });

  // ========================================
  // SCROLL PROGRESS INDICATOR
  // ========================================

  const scrollProgress = document.querySelector('.scroll-progress');
  if (scrollProgress) {
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;
      scrollProgress.style.width = `${scrollPercent}%`;
    }, { passive: true });
  }

  // ========================================
  // LAZY LOAD IMAGES
  // ========================================

  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    }, { rootMargin: '50px 0px' });

    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  // ========================================
  // SMOOTH REVEAL FOR BOXED GRIDS
  // ========================================

  const boxedGrids = document.querySelectorAll('.boxed-grid');
  boxedGrids.forEach(grid => {
    const items = grid.querySelectorAll('.boxed-grid-item');
    items.forEach((item, index) => {
      item.classList.add('animate-on-scroll');
      item.style.transitionDelay = `${index * 0.15}s`;
      animateObserver.observe(item);
    });
  });

  // ========================================
  // HORIZONTAL SCROLL WITH CUSTOM SCROLLBAR
  // ========================================

  const scrollWrappers = document.querySelectorAll('.scroll-wrapper');

  scrollWrappers.forEach(wrapper => {
    // Find any horizontal scroll container inside the wrapper
    const scrollContainer = wrapper.querySelector('.destinations-scroll, .itineraries-scroll, .journal-scroll') ||
                           wrapper.querySelector('[class*="-scroll"]:not(.scroll-track):not(.scroll-thumb)');
    const scrollTrack = wrapper.querySelector('.scroll-track');
    const scrollThumb = wrapper.querySelector('.scroll-thumb');

    if (!scrollContainer || !scrollTrack || !scrollThumb) return;

    // Update thumb position based on scroll
    const updateThumbPosition = () => {
      const scrollWidth = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      if (scrollWidth <= 0) return;
      const scrollPercent = scrollContainer.scrollLeft / scrollWidth;
      const thumbWidth = scrollThumb.offsetWidth;
      const trackWidth = scrollTrack.offsetWidth;
      const thumbMaxLeft = trackWidth - thumbWidth;
      scrollThumb.style.left = `${Math.max(0, scrollPercent * thumbMaxLeft)}px`;
    };

    // Update thumb width based on visible ratio
    const updateThumbWidth = () => {
      const visibleRatio = scrollContainer.clientWidth / scrollContainer.scrollWidth;
      const thumbWidth = Math.max(visibleRatio * 100, 20); // Minimum 20%
      scrollThumb.style.width = `${thumbWidth}%`;
    };

    // Initial setup with slight delay to ensure dimensions are calculated
    setTimeout(() => {
      updateThumbWidth();
      updateThumbPosition();
    }, 100);

    // Listen for scroll events with multiple fallbacks
    scrollContainer.addEventListener('scroll', () => {
      requestAnimationFrame(updateThumbPosition);
    }, { passive: true });

    // Also update on wheel events for better responsiveness
    scrollContainer.addEventListener('wheel', () => {
      setTimeout(updateThumbPosition, 10);
    }, { passive: true });

    // Update on any interaction
    scrollContainer.addEventListener('scrollend', updateThumbPosition, { passive: true });

    // Polling fallback for browsers that don't fire scroll events reliably
    let lastScrollLeft = 0;
    const pollScroll = () => {
      if (scrollContainer.scrollLeft !== lastScrollLeft) {
        lastScrollLeft = scrollContainer.scrollLeft;
        updateThumbPosition();
      }
      requestAnimationFrame(pollScroll);
    };
    requestAnimationFrame(pollScroll);

    window.addEventListener('resize', () => {
      updateThumbWidth();
      updateThumbPosition();
    });

    // Drag to scroll
    let isDown = false;
    let startX;
    let scrollLeft;

    scrollContainer.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - scrollContainer.offsetLeft;
      scrollLeft = scrollContainer.scrollLeft;
      scrollContainer.style.cursor = 'grabbing';
    });

    scrollContainer.addEventListener('mouseleave', () => {
      isDown = false;
      scrollContainer.style.cursor = 'grab';
    });

    scrollContainer.addEventListener('mouseup', () => {
      isDown = false;
      scrollContainer.style.cursor = 'grab';
    });

    scrollContainer.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 2;
      scrollContainer.scrollLeft = scrollLeft - walk;
    });

    // Click on track to scroll
    scrollTrack.addEventListener('click', (e) => {
      const trackRect = scrollTrack.getBoundingClientRect();
      const clickPosition = (e.clientX - trackRect.left) / trackRect.width;
      const scrollWidth = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      scrollContainer.scrollTo({
        left: clickPosition * scrollWidth,
        behavior: 'smooth'
      });
    });

    // Drag thumb to scroll
    let thumbDragging = false;

    scrollThumb.addEventListener('mousedown', (e) => {
      thumbDragging = true;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!thumbDragging) return;
      const trackRect = scrollTrack.getBoundingClientRect();
      const thumbWidth = scrollThumb.clientWidth;
      const newLeft = Math.min(
        Math.max(0, e.clientX - trackRect.left - thumbWidth / 2),
        trackRect.width - thumbWidth
      );
      const scrollPercent = newLeft / (trackRect.width - thumbWidth);
      const scrollWidth = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      scrollContainer.scrollLeft = scrollPercent * scrollWidth;
    });

    document.addEventListener('mouseup', () => {
      thumbDragging = false;
    });

    // ========================================
    // TOUCH SUPPORT FOR HORIZONTAL SCROLL
    // ========================================

    let touchStartX = 0;
    let touchStartScrollLeft = 0;
    let isTouchMoving = false;

    scrollContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].pageX;
      touchStartScrollLeft = scrollContainer.scrollLeft;
      isTouchMoving = true;
    }, { passive: true });

    scrollContainer.addEventListener('touchmove', (e) => {
      if (!isTouchMoving) return;
      const touchX = e.touches[0].pageX;
      const diff = touchStartX - touchX;
      scrollContainer.scrollLeft = touchStartScrollLeft + diff;
      requestAnimationFrame(updateThumbPosition);
    }, { passive: true });

    scrollContainer.addEventListener('touchend', () => {
      isTouchMoving = false;
    }, { passive: true });
  });

  // ========================================
  // DISABLE PARALLAX ON MOBILE FOR PERFORMANCE
  // ========================================

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isMobile || prefersReducedMotion) {
    // Remove parallax transforms on mobile for smoother scrolling
    document.querySelectorAll('.hero-bg video, .hero-bg img, .parallax-bg').forEach(el => {
      el.style.transform = 'none';
    });

    // Disable magnetic buttons on touch devices
    document.querySelectorAll('.btn').forEach(btn => {
      btn.style.transform = 'none';
    });
  }

  // ========================================
  // MOBILE MENU - CLOSE ON ESCAPE KEY
  // ========================================

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const mobileMenu = document.querySelector('.mobile-menu');
      const menuToggle = document.querySelector('.menu-toggle');
      if (mobileMenu && mobileMenu.classList.contains('active')) {
        mobileMenu.classList.remove('active');
        menuToggle.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  });

  // ========================================
  // PREVENT BODY SCROLL WHEN MENU OPEN
  // ========================================

  const preventBodyScroll = (e) => {
    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu && mobileMenu.classList.contains('active')) {
      e.preventDefault();
    }
  };

  document.addEventListener('touchmove', preventBodyScroll, { passive: false });
});
