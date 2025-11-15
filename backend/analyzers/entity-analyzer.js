/**
 * Entity Analyzer
 *
 * Advanced entity recognition and knowledge graph analysis
 * Implements requirements from PDF Rubric v3.0:
 * - Named Entity Markup
 * - Entity Relationship Mapping
 * - Knowledge Graph Connections
 * - Geographic Entity Precision
 * - Professional Entity Verification
 */

class EntityAnalyzer {
  constructor(evidence) {
    this.evidence = evidence;
    this.entities = {
      people: [],
      organizations: [],
      places: [],
      products: [],
      events: [],
      professionalCredentials: [],
      relationships: []
    };
  }

  /**
   * Main analysis method
   */
  analyze() {
    // Extract entities from Schema.org structured data
    this.extractSchemaEntities();

    // Extract entities from text content
    this.extractTextEntities();

    // Map entity relationships
    this.mapEntityRelationships();

    // Analyze geographic entities
    this.analyzeGeographicEntities();

    // Verify professional entities
    this.verifyProfessionalEntities();

    return {
      entities: this.entities,
      metrics: this.calculateMetrics(),
      knowledgeGraph: this.buildKnowledgeGraph()
    };
  }

  /**
   * Extract entities from Schema.org JSON-LD
   */
  extractSchemaEntities() {
    const { structuredData } = this.evidence.technical;

    for (const schema of structuredData) {
      const raw = schema.raw;
      const type = raw['@type'];

      // Person entities
      if (type === 'Person') {
        this.entities.people.push({
          name: raw.name,
          jobTitle: raw.jobTitle,
          affiliation: raw.affiliation?.name,
          sameAs: raw.sameAs || [],
          email: raw.email,
          telephone: raw.telephone,
          source: 'schema'
        });
      }

      // Organization entities
      if (type === 'Organization' || type === 'LocalBusiness') {
        this.entities.organizations.push({
          name: raw.name,
          type: type,
          address: raw.address,
          geo: raw.geo,
          telephone: raw.telephone,
          email: raw.email,
          sameAs: raw.sameAs || [],
          founder: raw.founder,
          numberOfEmployees: raw.numberOfEmployees,
          source: 'schema'
        });
      }

      // Place entities
      if (type === 'Place' || raw.address) {
        this.entities.places.push({
          name: raw.name,
          address: this.parseAddress(raw.address),
          geo: raw.geo,
          source: 'schema'
        });
      }

      // Product entities
      if (type === 'Product' || type === 'Service') {
        this.entities.products.push({
          name: raw.name,
          description: raw.description,
          brand: raw.brand?.name,
          offers: raw.offers,
          source: 'schema'
        });
      }

      // Event entities
      if (type === 'Event') {
        this.entities.events.push({
          name: raw.name,
          startDate: raw.startDate,
          location: raw.location,
          organizer: raw.organizer?.name,
          source: 'schema'
        });
      }
    }
  }

  /**
   * Extract entities from text content using patterns
   */
  extractTextEntities() {
    const text = this.evidence.content.bodyText;

    // Extract capitalized phrases (potential proper nouns)
    const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

    // Extract organizations (Inc., LLC, Corp., etc.)
    const orgPatterns = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(Inc\.|LLC|Corp\.|Corporation|Company|Ltd\.)/g;
    const orgMatches = text.matchAll(orgPatterns);
    for (const match of orgMatches) {
      if (!this.entities.organizations.some(o => o.name === match[0])) {
        this.entities.organizations.push({
          name: match[0],
          source: 'text'
        });
      }
    }

    // Extract phone numbers
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const phones = text.match(phonePattern) || [];

    // Extract email addresses
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailPattern) || [];

    // Extract addresses (simple pattern)
    const addressPattern = /\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)/gi;
    const addresses = text.match(addressPattern) || [];

    addresses.forEach(addr => {
      if (!this.entities.places.some(p => p.address?.streetAddress === addr)) {
        this.entities.places.push({
          address: { streetAddress: addr },
          source: 'text'
        });
      }
    });

    // Extract professional credentials
    this.extractProfessionalCredentials(text);
  }

  /**
   * Extract professional credentials and certifications
   */
  extractProfessionalCredentials(text) {
    const credentials = [
      // Degrees
      { pattern: /\b(PhD|Ph\.D\.|Doctor of Philosophy)\b/gi, type: 'degree', name: 'PhD' },
      { pattern: /\b(MBA|Master of Business Administration)\b/gi, type: 'degree', name: 'MBA' },
      { pattern: /\b(MD|M\.D\.|Doctor of Medicine)\b/gi, type: 'degree', name: 'MD' },
      { pattern: /\b(JD|J\.D\.|Juris Doctor)\b/gi, type: 'degree', name: 'JD' },
      { pattern: /\b(Bachelor'?s?\s+Degree)\b/gi, type: 'degree', name: 'Bachelor\'s Degree' },
      { pattern: /\b(Master'?s?\s+Degree)\b/gi, type: 'degree', name: 'Master\'s Degree' },

      // Certifications
      { pattern: /\b(CPA|Certified Public Accountant)\b/gi, type: 'certification', name: 'CPA' },
      { pattern: /\b(PMP|Project Management Professional)\b/gi, type: 'certification', name: 'PMP' },
      { pattern: /\b(CFA|Chartered Financial Analyst)\b/gi, type: 'certification', name: 'CFA' },
      { pattern: /\b(PE|Professional Engineer)\b/gi, type: 'certification', name: 'PE' },
      { pattern: /\b(RN|Registered Nurse)\b/gi, type: 'certification', name: 'RN' },
      { pattern: /\b(AWS Certified|Azure Certified|Google Cloud Certified)\b/gi, type: 'certification', name: 'Cloud Certification' },

      // Licenses
      { pattern: /\b(Licensed\s+\w+)\b/gi, type: 'license', name: 'Professional License' },
      { pattern: /\b(Board\s+Certified)\b/gi, type: 'certification', name: 'Board Certification' },

      // Memberships
      { pattern: /\b(Member of|Fellow of)\s+([A-Z][A-Za-z\s]+)\b/gi, type: 'membership', name: 'Professional Membership' }
    ];

    for (const cred of credentials) {
      const matches = text.match(cred.pattern);
      if (matches) {
        matches.forEach(match => {
          if (!this.entities.professionalCredentials.some(c => c.value === match)) {
            this.entities.professionalCredentials.push({
              type: cred.type,
              name: cred.name,
              value: match,
              source: 'text'
            });
          }
        });
      }
    }
  }

  /**
   * Map relationships between entities
   */
  mapEntityRelationships() {
    const { structuredData } = this.evidence.technical;

    for (const schema of structuredData) {
      const raw = schema.raw;

      // Person -> Organization relationships
      if (raw['@type'] === 'Person' && raw.affiliation) {
        this.entities.relationships.push({
          subject: { type: 'Person', name: raw.name },
          predicate: 'worksFor',
          object: { type: 'Organization', name: raw.affiliation.name }
        });
      }

      // Organization -> Place relationships
      if ((raw['@type'] === 'Organization' || raw['@type'] === 'LocalBusiness') && raw.address) {
        this.entities.relationships.push({
          subject: { type: 'Organization', name: raw.name },
          predicate: 'locatedAt',
          object: { type: 'Place', address: this.parseAddress(raw.address) }
        });
      }

      // Product -> Organization relationships
      if (raw['@type'] === 'Product' && raw.brand) {
        this.entities.relationships.push({
          subject: { type: 'Product', name: raw.name },
          predicate: 'manufacturedBy',
          object: { type: 'Organization', name: raw.brand.name }
        });
      }

      // Event -> Place relationships
      if (raw['@type'] === 'Event' && raw.location) {
        this.entities.relationships.push({
          subject: { type: 'Event', name: raw.name },
          predicate: 'locatedAt',
          object: { type: 'Place', name: raw.location.name }
        });
      }

      // SameAs relationships (Knowledge Graph connections)
      if (raw.sameAs) {
        const sameAsArray = Array.isArray(raw.sameAs) ? raw.sameAs : [raw.sameAs];
        sameAsArray.forEach(url => {
          this.entities.relationships.push({
            subject: { type: raw['@type'], name: raw.name },
            predicate: 'sameAs',
            object: { type: 'ExternalEntity', url }
          });
        });
      }
    }
  }

  /**
   * Analyze geographic entities with precision
   */
  analyzeGeographicEntities() {
    const { metadata } = this.evidence;

    // Extract from metadata
    if (metadata.geoRegion || metadata.geoPlacename) {
      this.entities.places.push({
        region: metadata.geoRegion,
        placename: metadata.geoPlacename,
        source: 'metadata',
        precision: 'high'
      });
    }

    // Extract coordinates from Schema.org geo
    for (const org of this.entities.organizations) {
      if (org.geo) {
        this.entities.places.push({
          latitude: org.geo.latitude,
          longitude: org.geo.longitude,
          associatedWith: org.name,
          source: 'schema',
          precision: 'exact'
        });
      }
    }

    // Extract city/state/country from text
    const text = this.evidence.content.bodyText;

    // US States
    const statePattern = /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g;
    const states = text.match(statePattern) || [];

    states.forEach(state => {
      if (!this.entities.places.some(p => p.state === state)) {
        this.entities.places.push({
          state,
          country: 'USA',
          source: 'text',
          precision: 'moderate'
        });
      }
    });
  }

  /**
   * Verify professional entities
   */
  verifyProfessionalEntities() {
    // Check if organizations have verification signals
    for (const org of this.entities.organizations) {
      org.verified = false;

      // Verification signals:
      // 1. Has sameAs links (knowledge graph)
      if (org.sameAs && org.sameAs.length > 0) {
        org.verified = true;
        org.verificationSource = 'knowledge-graph';
      }

      // 2. Has complete contact info
      if (org.telephone && org.email && org.address) {
        org.verified = true;
        org.verificationSource = 'complete-contact';
      }

      // 3. Has geo coordinates
      if (org.geo) {
        org.verified = true;
        org.verificationSource = 'geo-coordinates';
      }
    }

    // Check if people have verification signals
    for (const person of this.entities.people) {
      person.verified = false;

      // Verification signals:
      // 1. Has sameAs links (social profiles)
      if (person.sameAs && person.sameAs.length > 0) {
        person.verified = true;
        person.verificationSource = 'social-profiles';
      }

      // 2. Has affiliation
      if (person.affiliation) {
        person.verified = true;
        person.verificationSource = 'affiliation';
      }

      // 3. Has job title
      if (person.jobTitle) {
        person.verified = true;
        person.verificationSource = 'job-title';
      }
    }
  }

  /**
   * Calculate entity metrics
   */
  calculateMetrics() {
    return {
      totalEntities: this.countTotalEntities(),
      entitiesByType: {
        people: this.entities.people.length,
        organizations: this.entities.organizations.length,
        places: this.entities.places.length,
        products: this.entities.products.length,
        events: this.entities.events.length,
        credentials: this.entities.professionalCredentials.length
      },
      relationships: this.entities.relationships.length,
      verifiedEntities: this.countVerifiedEntities(),
      knowledgeGraphConnections: this.countKnowledgeGraphConnections(),
      geoPrecision: this.calculateGeoPrecision(),
      professionalVerification: this.entities.professionalCredentials.length > 0
    };
  }

  /**
   * Build knowledge graph representation
   */
  buildKnowledgeGraph() {
    const nodes = [];
    const edges = [];

    // Add entity nodes
    this.entities.people.forEach(p => {
      nodes.push({ id: p.name, type: 'Person', data: p });
    });

    this.entities.organizations.forEach(o => {
      nodes.push({ id: o.name, type: 'Organization', data: o });
    });

    this.entities.places.forEach((p, i) => {
      const id = p.placename || p.address?.streetAddress || `Place-${i}`;
      nodes.push({ id, type: 'Place', data: p });
    });

    // Add relationship edges
    this.entities.relationships.forEach((rel, i) => {
      edges.push({
        id: `edge-${i}`,
        from: rel.subject.name || rel.subject.type,
        to: rel.object.name || rel.object.url || rel.object.type,
        relationship: rel.predicate
      });
    });

    return { nodes, edges };
  }

  // ===== HELPER METHODS =====

  parseAddress(address) {
    if (typeof address === 'string') {
      return { streetAddress: address };
    }

    return {
      streetAddress: address.streetAddress,
      addressLocality: address.addressLocality,
      addressRegion: address.addressRegion,
      postalCode: address.postalCode,
      addressCountry: address.addressCountry
    };
  }

  countTotalEntities() {
    return this.entities.people.length +
           this.entities.organizations.length +
           this.entities.places.length +
           this.entities.products.length +
           this.entities.events.length;
  }

  countVerifiedEntities() {
    const verifiedPeople = this.entities.people.filter(p => p.verified).length;
    const verifiedOrgs = this.entities.organizations.filter(o => o.verified).length;
    return verifiedPeople + verifiedOrgs;
  }

  countKnowledgeGraphConnections() {
    return this.entities.relationships.filter(r => r.predicate === 'sameAs').length;
  }

  calculateGeoPrecision() {
    if (this.entities.places.length === 0) return 0;

    const precisionScores = {
      'exact': 1.0,      // Has coordinates
      'high': 0.8,       // Has placename + region
      'moderate': 0.5,   // Has state/city
      'low': 0.2         // Generic mention
    };

    const totalScore = this.entities.places.reduce((sum, place) => {
      return sum + (precisionScores[place.precision] || 0);
    }, 0);

    return totalScore / this.entities.places.length;
  }
}

module.exports = EntityAnalyzer;
