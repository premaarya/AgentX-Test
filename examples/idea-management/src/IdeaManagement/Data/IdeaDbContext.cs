using Microsoft.EntityFrameworkCore;
using IdeaManagement.Models;

namespace IdeaManagement.Data;

/// <summary>
/// Database context for Idea Management system
/// </summary>
public class IdeaDbContext : DbContext
{
    public IdeaDbContext(DbContextOptions<IdeaDbContext> options) : base(options)
    {
    }
    
    /// <summary>
    /// Ideas table
    /// </summary>
    public DbSet<Idea> Ideas => Set<Idea>();
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        modelBuilder.ApplyConfiguration(new IdeaConfiguration());
    }
}
