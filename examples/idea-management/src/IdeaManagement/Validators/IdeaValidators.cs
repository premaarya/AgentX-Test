using FluentValidation;
using IdeaManagement.Models;

namespace IdeaManagement.Validators;

/// <summary>
/// Validation rules for creating a new idea
/// </summary>
public class CreateIdeaValidator : AbstractValidator<Idea>
{
    public CreateIdeaValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required")
            .MaximumLength(200).WithMessage("Title cannot exceed 200 characters");
        
        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(2000).WithMessage("Description cannot exceed 2000 characters");
        
        RuleFor(x => x.SubmittedBy)
            .NotEmpty().WithMessage("SubmittedBy is required")
            .MaximumLength(255).WithMessage("SubmittedBy cannot exceed 255 characters")
            .EmailAddress().When(x => x.SubmittedBy?.Contains('@') == true)
            .WithMessage("SubmittedBy must be a valid email address when it contains @");
        
        // BusinessCase validation when provided
        When(x => x.BusinessCase != null, () =>
        {
            RuleFor(x => x.BusinessCase!.EstimatedROI)
                .GreaterThan(0).WithMessage("Estimated ROI must be greater than 0");
            
            RuleFor(x => x.BusinessCase!.EstimatedEffortHours)
                .GreaterThan(0).WithMessage("Estimated effort hours must be greater than 0");
            
            RuleFor(x => x.BusinessCase!.RiskLevel)
                .IsInEnum().WithMessage("Invalid risk level");
        });
        
        RuleFor(x => x.ImpactMetrics)
            .MaximumLength(1000).WithMessage("Impact metrics cannot exceed 1000 characters")
            .When(x => !string.IsNullOrWhiteSpace(x.ImpactMetrics));
        
        RuleFor(x => x.ReviewerNotes)
            .MaximumLength(2000).WithMessage("Reviewer notes cannot exceed 2000 characters")
            .When(x => !string.IsNullOrWhiteSpace(x.ReviewerNotes));
    }
}

/// <summary>
/// Validation rules for updating an existing idea
/// </summary>
public class UpdateIdeaValidator : AbstractValidator<Idea>
{
    public UpdateIdeaValidator()
    {
        RuleFor(x => x.Id)
            .GreaterThan(0).WithMessage("Id must be greater than 0");
        
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required")
            .MaximumLength(200).WithMessage("Title cannot exceed 200 characters");
        
        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Description is required")
            .MaximumLength(2000).WithMessage("Description cannot exceed 2000 characters");
        
        // BusinessCase validation when provided
        When(x => x.BusinessCase != null, () =>
        {
            RuleFor(x => x.BusinessCase!.EstimatedROI)
                .GreaterThan(0).WithMessage("Estimated ROI must be greater than 0");
            
            RuleFor(x => x.BusinessCase!.EstimatedEffortHours)
                .GreaterThan(0).WithMessage("Estimated effort hours must be greater than 0");
            
            RuleFor(x => x.BusinessCase!.RiskLevel)
                .IsInEnum().WithMessage("Invalid risk level");
        });
        
        RuleFor(x => x.ImpactMetrics)
            .MaximumLength(1000).WithMessage("Impact metrics cannot exceed 1000 characters")
            .When(x => !string.IsNullOrWhiteSpace(x.ImpactMetrics));
        
        RuleFor(x => x.ReviewerNotes)
            .MaximumLength(2000).WithMessage("Reviewer notes cannot exceed 2000 characters")
            .When(x => !string.IsNullOrWhiteSpace(x.ReviewerNotes));
    }
}
