namespace IdeaManagement.Models;

/// <summary>
/// Represents the risk level associated with implementing an idea
/// </summary>
public enum RiskLevel
{
    /// <summary>
    /// Low risk - minimal potential for negative impact
    /// </summary>
    Low = 0,
    
    /// <summary>
    /// Medium risk - moderate potential for negative impact
    /// </summary>
    Medium = 1,
    
    /// <summary>
    /// High risk - significant potential for negative impact
    /// </summary>
    High = 2
}
