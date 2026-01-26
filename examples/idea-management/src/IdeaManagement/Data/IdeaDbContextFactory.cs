using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace IdeaManagement.Data;

/// <summary>
/// Design-time factory for creating IdeaDbContext during migrations
/// </summary>
public class IdeaDbContextFactory : IDesignTimeDbContextFactory<IdeaDbContext>
{
    public IdeaDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<IdeaDbContext>();
        
        // Use a temporary connection string for migrations
        // In production, this comes from appsettings.json
        optionsBuilder.UseNpgsql("Host=localhost;Database=ideamanagement;Username=postgres;Password=postgres");
        
        return new IdeaDbContext(optionsBuilder.Options);
    }
}
