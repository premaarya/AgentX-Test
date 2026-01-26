using FluentAssertions;
using IdeaManagement.Models;
using Xunit;

namespace IdeaManagement.Tests.UnitTests.Models;

/// <summary>
/// Unit tests for Idea model
/// </summary>
public class IdeaTests
{
    [Fact]
    public void CalculateSimilarity_WithIdenticalIdeas_ShouldReturn1()
    {
        // Arrange
        var idea1 = new Idea
        {
            Title = "Improve User Dashboard",
            Description = "Add new features to the user dashboard to improve usability"
        };
        
        var idea2 = new Idea
        {
            Title = "Improve User Dashboard",
            Description = "Add new features to the user dashboard to improve usability"
        };
        
        // Act
        var similarity = idea1.CalculateSimilarity(idea2);
        
        // Assert
        similarity.Should().Be(1m);
    }
    
    [Fact]
    public void CalculateSimilarity_WithCompletelyDifferentIdeas_ShouldReturnZero()
    {
        // Arrange
        var idea1 = new Idea
        {
            Title = "Machine Learning Integration",
            Description = "Implement predictive analytics using ML algorithms"
        };
        
        var idea2 = new Idea
        {
            Title = "Database Optimization",
            Description = "Improve query performance by adding indexes"
        };
        
        // Act
        var similarity = idea1.CalculateSimilarity(idea2);
        
        // Assert
        similarity.Should().BeLessThan(0.2m);
    }
    
    [Fact]
    public void CalculateSimilarity_WithSimilarIdeas_ShouldReturnModerateScore()
    {
        // Arrange
        var idea1 = new Idea
        {
            Title = "Improve Dashboard Performance",
            Description = "Optimize the user dashboard to load faster and handle more data efficiently"
        };
        
        var idea2 = new Idea
        {
            Title = "Enhance Dashboard Experience",
            Description = "Make the user dashboard faster and more responsive with better data handling"
        };
        
        // Act
        var similarity = idea1.CalculateSimilarity(idea2);
        
        // Assert
        similarity.Should().BeGreaterThan(0.3m).And.BeLessThan(0.8m);
    }
    
    [Fact]
    public void CalculateSimilarity_WithNullIdea_ShouldReturnZero()
    {
        // Arrange
        var idea = new Idea { Title = "Test", Description = "Test" };
        
        // Act
        var similarity = idea.CalculateSimilarity(null!);
        
        // Assert
        similarity.Should().Be(0m);
    }
    
    [Fact]
    public void CalculateSimilarity_WithEmptyStrings_ShouldReturnZero()
    {
        // Arrange
        var idea1 = new Idea { Title = "", Description = "" };
        var idea2 = new Idea { Title = "Test", Description = "Description" };
        
        // Act
        var similarity = idea1.CalculateSimilarity(idea2);
        
        // Assert
        similarity.Should().Be(0m);
    }
    
    [Fact]
    public void NewIdea_ShouldHaveSubmittedStatus()
    {
        // Arrange & Act
        var idea = new Idea
        {
            Title = "Test Idea",
            Description = "Test Description",
            SubmittedBy = "test@example.com"
        };
        
        // Assert
        idea.Status.Should().Be(WorkflowState.Submitted);
    }
    
    [Fact]
    public void NewIdea_ShouldHaveUtcTimestamps()
    {
        // Arrange
        var beforeCreate = DateTime.UtcNow.AddSeconds(-1);
        
        // Act
        var idea = new Idea
        {
            Title = "Test",
            Description = "Test"
        };
        
        var afterCreate = DateTime.UtcNow.AddSeconds(1);
        
        // Assert
        idea.SubmittedDate.Should().BeAfter(beforeCreate).And.BeBefore(afterCreate);
        idea.LastModifiedDate.Should().BeAfter(beforeCreate).And.BeBefore(afterCreate);
    }
}
