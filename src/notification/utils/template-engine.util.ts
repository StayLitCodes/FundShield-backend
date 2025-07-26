import { Injectable } from "@nestjs/common"

@Injectable()
export class TemplateEngineUtil {
  /**
   * Simple template engine that replaces {{variable}} with actual values
   */
  render(template: string, data: Record<string, any>): string {
    let result = template

    // Replace {{variable}} patterns
    const variablePattern = /\{\{([^}]+)\}\}/g
    result = result.replace(variablePattern, (match, variableName) => {
      const trimmedName = variableName.trim()
      const value = this.getNestedValue(data, trimmedName)
      return value !== undefined ? String(value) : match
    })

    // Replace {variable} patterns (alternative syntax)
    const altVariablePattern = /\{([^}]+)\}/g
    result = result.replace(altVariablePattern, (match, variableName) => {
      const trimmedName = variableName.trim()
      const value = this.getNestedValue(data, trimmedName)
      return value !== undefined ? String(value) : match
    })

    return result
  }

  /**
   * Get nested value from object using dot notation
   * e.g., 'user.name' from { user: { name: 'John' } }
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * Extract variables from template
   */
  extractVariables(template: string): string[] {
    const variables = new Set<string>()

    // Extract {{variable}} patterns
    const variablePattern = /\{\{([^}]+)\}\}/g
    let match
    while ((match = variablePattern.exec(template)) !== null) {
      variables.add(match[1].trim())
    }

    // Extract {variable} patterns
    const altVariablePattern = /\{([^}]+)\}/g
    while ((match = altVariablePattern.exec(template)) !== null) {
      variables.add(match[1].trim())
    }

    return Array.from(variables)
  }

  /**
   * Validate template against provided data
   */
  validateTemplate(
    template: string,
    data: Record<string, any>,
  ): {
    isValid: boolean
    missingVariables: string[]
  } {
    const variables = this.extractVariables(template)
    const missingVariables = variables.filter((variable) => {
      const value = this.getNestedValue(data, variable)
      return value === undefined
    })

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
    }
  }
}
