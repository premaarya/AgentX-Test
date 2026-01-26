using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using IdeaManagement.Models;
using System.Text.Json;

namespace IdeaManagement.Data;

/// <summary>
/// Entity Framework Core configuration for Idea entity
/// </summary>
public class IdeaConfiguration : IEntityTypeConfiguration<Idea>
{
    public void Configure(EntityTypeBuilder<Idea> builder)
    {
        builder.ToTable("ideas");
        
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();
        
        builder.Property(i => i.Title)
            .HasColumnName("title")
            .HasMaxLength(200)
            .IsRequired();
        
        builder.Property(i => i.Description)
            .HasColumnName("description")
            .HasMaxLength(2000)
            .IsRequired();
        
        builder.Property(i => i.SubmittedBy)
            .HasColumnName("submitted_by")
            .HasMaxLength(255)
            .IsRequired();
        
        builder.Property(i => i.SubmittedDate)
            .HasColumnName("submitted_date")
            .IsRequired();
        
        builder.Property(i => i.Status)
            .HasColumnName("status")
            .HasConversion<string>() // Store enum as string for better readability
            .HasMaxLength(20)
            .IsRequired();
        
        // BusinessCase as owned entity (stored in same table)
        builder.OwnsOne(i => i.BusinessCase, bc =>
        {
            bc.Property(b => b.EstimatedROI)
                .HasColumnName("estimated_roi")
                .HasPrecision(18, 2);
            
            bc.Property(b => b.EstimatedEffortHours)
                .HasColumnName("estimated_effort_hours");
            
            bc.Property(b => b.RiskLevel)
                .HasColumnName("risk_level")
                .HasConversion<string>()
                .HasMaxLength(10);
        });
        
        builder.Property(i => i.ImpactMetrics)
            .HasColumnName("impact_metrics")
            .HasMaxLength(1000);
        
        builder.Property(i => i.LastModifiedDate)
            .HasColumnName("last_modified_date")
            .IsRequired();
        
        builder.Property(i => i.ReviewerNotes)
            .HasColumnName("reviewer_notes")
            .HasMaxLength(2000);
        
        // Indexes for common queries
        builder.HasIndex(i => i.Status);
        builder.HasIndex(i => i.SubmittedDate);
        builder.HasIndex(i => i.SubmittedBy);
    }
}
