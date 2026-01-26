namespace IdeaManagement.Models;

/// <summary>
/// Value object representing the business case for an idea
/// Includes financial and effort metrics for decision-making
/// </summary>
public sealed class BusinessCase
{
    /// <summary>
    /// Expected return on investment as a percentage (e.g., 1.5 = 150%)
    /// Must be positive
    /// </summary>
    public decimal EstimatedROI { get; init; }
    
    /// <summary>
    /// Estimated effort required in person-hours
    /// Must be positive
    /// </summary>
    public int EstimatedEffortHours { get; init; }
    
    /// <summary>
    /// Risk level associated with implementing this idea
    /// </summary>
    public RiskLevel RiskLevel { get; init; }
    
    /// <summary>
    /// Calculated priority score: ROI / Effort (higher is better)
    /// Adjusted by risk multiplier: Low=1.0, Medium=0.8, High=0.6
    /// </summary>
    public decimal PriorityScore
    {
        get
        {
            if (EstimatedEffortHours == 0) return 0;
            
            var riskMultiplier = RiskLevel switch
            {
                RiskLevel.Low => 1.0m,
                RiskLevel.Medium => 0.8m,
                RiskLevel.High => 0.6m,
                _ => 1.0m
            };
            
            return (EstimatedROI / EstimatedEffortHours) * riskMultiplier;
        }
    }
    
    /// <summary>
    /// Parameterless constructor for JSON deserialization
    /// </summary>
    public BusinessCase() { }
    
    /// <summary>
    /// Creates a new business case with validation
    /// </summary>
    /// <param name="estimatedROI">Expected ROI percentage (must be positive)</param>
    /// <param name="estimatedEffortHours">Effort in hours (must be positive)</param>
    /// <param name="riskLevel">Risk level</param>
    /// <returns>Validated BusinessCase instance</returns>
    /// <exception cref="ArgumentOutOfRangeException">If ROI or effort are not positive</exception>
    public static BusinessCase Create(decimal estimatedROI, int estimatedEffortHours, RiskLevel riskLevel)
    {
        if (estimatedROI <= 0)
            throw new ArgumentOutOfRangeException(nameof(estimatedROI), "ROI must be positive");
        
        if (estimatedEffortHours <= 0)
            throw new ArgumentOutOfRangeException(nameof(estimatedEffortHours), "Effort hours must be positive");
        
        return new BusinessCase
        {
            EstimatedROI = estimatedROI,
            EstimatedEffortHours = estimatedEffortHours,
            RiskLevel = riskLevel
        };
    }
}
