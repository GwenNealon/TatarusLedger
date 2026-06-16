import './App.css';

function App() {
  return (
    <div className="App">
      <main className="App-content">
        <h1>React TypeScript Template</h1>
        <p>
          A clean Create React App starter configured with TypeScript for
          general-purpose development.
        </p>
        <section className="App-actions" aria-label="available scripts">
          <h2>Available scripts</h2>
          <ul>
            <li>
              <code>npm start</code> to run the development server
            </li>
            <li>
              <code>npm test</code> to run the test suite
            </li>
            <li>
              <code>npm run build</code> to create a production build
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
