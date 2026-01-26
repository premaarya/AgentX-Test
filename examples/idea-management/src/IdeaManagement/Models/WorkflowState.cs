namespace IdeaManagement.Models;

/// <summary>
/// Represents the lifecycle stages of an idea from submission to production
/// </summary>
public enum WorkflowState
{
    /// <summary>
    /// Idea has been submitted and awaits initial review
    /// </summary>
    Submitted = 0,
    
    /// <summary>
    /// Idea is under evaluation for feasibility and business value
    /// </summary>
    InReview = 1,
    
    /// <summary>
    /// Idea has been approved for implementation
    /// </summary>
    Approved = 2,
    
    /// <summary>
    /// Idea was evaluated but not approved
    /// </summary>
    NotApproved = 3,
    
    /// <summary>
    /// Approved idea is being developed
    /// </summary>
    InDevelopment = 4,
    
    /// <summary>
    /// Developed idea is deployed to production
    /// </summary>
    InProduction = 5
}
