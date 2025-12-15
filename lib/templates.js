// Template system for Logseq Web Clipper

const Templates = {
  // Built-in templates
  builtIn: {
    article: {
      name: 'Article',
      template: `- **{{title}}**
  collapsed:: true
  type:: article
  url:: {{url}}
  date-clipped:: {{date}}
  tags:: {{tags}}
  - {{content}}`
    },
    video: {
      name: 'Video/YouTube',
      template: `- **{{title}}**
  collapsed:: true
  type:: video
  url:: {{url}}
  date-clipped:: {{date}}
  tags:: {{tags}}
  - ## Notes
    - {{content}}`
    },
    tweet: {
      name: 'Tweet/Social',
      template: `- **Tweet from {{author}}**
  type:: tweet
  url:: {{url}}
  date-clipped:: {{date}}
  - > {{content}}`
    },
    recipe: {
      name: 'Recipe',
      template: `- **{{title}}**
  collapsed:: true
  type:: recipe
  url:: {{url}}
  date-clipped:: {{date}}
  tags:: recipe, {{tags}}
  - ## Ingredients
    -
  - ## Instructions
    - {{content}}`
    },
    bookmark: {
      name: 'Simple Bookmark',
      template: `- [{{title}}]({{url}})
  date-clipped:: {{date}}
  tags:: {{tags}}`
    },
    quote: {
      name: 'Quote',
      template: `- > {{selection}}
  source:: [{{title}}]({{url}})
  date-clipped:: {{date}}`
    }
  },

  // Parse template variables
  parse(template, data) {
    const variables = {
      title: data.title || 'Untitled',
      url: data.url || '',
      date: data.date || this.formatDate(new Date()),
      content: data.content || '',
      selection: data.selection || data.content || '',
      author: data.author || 'Unknown',
      tags: data.tags || ''
    };

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  },

  // Format date for Logseq
  formatDate(date, format = 'yyyy-MM-dd') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format
      .replace('yyyy', year)
      .replace('MM', month)
      .replace('dd', day);
  },

  // Get template by name (built-in or custom)
  async get(name) {
    if (this.builtIn[name]) {
      return this.builtIn[name].template;
    }
    // Check custom templates
    const custom = await Storage.getTemplates();
    if (custom[name]) {
      return custom[name];
    }
    return null;
  },

  // Get all available templates
  async getAll() {
    const custom = await Storage.getTemplates();
    const all = {};

    // Add built-in templates
    for (const [key, value] of Object.entries(this.builtIn)) {
      all[key] = { ...value, isBuiltIn: true };
    }

    // Add custom templates
    for (const [key, value] of Object.entries(custom)) {
      all[key] = { name: key, template: value, isBuiltIn: false };
    }

    return all;
  },

  // Validate template (check for required variables)
  validate(template) {
    const requiredVars = ['title', 'url'];
    const warnings = [];

    for (const v of requiredVars) {
      if (!template.includes(`{{${v}}}`)) {
        warnings.push(`Template is missing {{${v}}} variable`);
      }
    }

    return {
      valid: true,
      warnings
    };
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Templates;
}
