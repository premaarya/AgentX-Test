using FluentAssertions;
using IdeaManagement.Models;
using Xunit;

namespace IdeaManagement.Tests.UnitTests.Models;

/// <summary>
/// Unit tests for BusinessCase value object
/// </summary>
public class BusinessCaseTests
{
    [Fact]
    public void Create_WithValidValues_ShouldSucceed()
    {
        // Act
        var businessCase = BusinessCase.Create(1.5m, 100, RiskLevel.Low);
        
        // Assert
        businessCase.EstimatedROI.Should().Be(1.5m);
        businessCase.EstimatedEffortHours.Should().Be(100);
        businessCase.RiskLevel.Should().Be(RiskLevel.Low);
    }
    
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-10.5)]
    public void Create_WithZeroOrNegativeROI_ShouldThrowException(decimal roi)
    {
        // Act
        var act = () => BusinessCase.Create(roi, 100, RiskLevel.Low);
        
        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("estimatedROI");
    }
    
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-100)]
    public void Create_WithZeroOrNegativeEffort_ShouldThrowException(int effort)
    {
        // Act
        var act = () => BusinessCase.Create(1.5m, effort, RiskLevel.Low);
        
        // Assert
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("estimatedEffortHours");
    }
    
    [Theory]
    [InlineData(150, 100, RiskLevel.Low, 1.5)] // ROI 1.5, Effort 100, Risk Low (1.0x) = 0.015
    [InlineData(200, 100, RiskLevel.Medium, 1.6)] // ROI 2.0, Effort 100, Risk Medium (0.8x) = 0.016
    [InlineData(300, 100, RiskLevel.High, 1.8)] // ROI 3.0, Effort 100, Risk High (0.6x) = 0.018
    public void PriorityScore_ShouldCalculateCorrectly(int roi, int effort, RiskLevel risk, decimal expectedScore)
    {
        // Arrange
        var businessCase = BusinessCase.Create(roi, effort, risk);
        
        // Act
        var score = businessCase.PriorityScore;
        
        // Assert
        score.Should().Be(expectedScore);
    }
    
    [Fact]
    public void PriorityScore_WithHighROILowEffortLowRisk_ShouldReturnHighScore()
    {
        // Arrange
        var businessCase = BusinessCase.Create(500, 10, RiskLevel.Low);
        
        // Act
        var score = businessCase.PriorityScore;
        
        // Assert
        score.Should().BeGreaterThan(10m);
    }
    
    [Fact]
    public void PriorityScore_WithLowROIHighEffortHighRisk_ShouldReturnLowScore()
    {
        // Arrange
        var businessCase = BusinessCase.Create(1.2m, 1000, RiskLevel.High);
        
        // Act
        var score = businessCase.PriorityScore;
        
        // Assert
        score.Should().BeLessThan(0.01m);
    }
}
