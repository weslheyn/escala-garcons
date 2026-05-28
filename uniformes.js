
const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('[data-page]');

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.page;

    pages.forEach(page => {
      page.classList.remove('active');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    const targetPage = document.getElementById(target);

    if(targetPage){
      targetPage.classList.add('active');
    }

    if(btn.classList.contains('nav-item')){
      btn.classList.add('active');
    }
  });
});

const uniformesPorSetor = {
  'Garçom': ['Camisa Social', 'Calça Social', 'Avental', 'Sapato Social'],
  'Cumim': ['Camisa Cumim', 'Avental Cumim'],
  'Bar': ['Camisa Bar', 'Avental Bar'],
  'Recepção': ['Blazer', 'Camisa Recepção'],
  'Cozinha': ['Dolmã', 'Calça Cozinha']
};

function atualizarUniformes(selectSetorId, selectUniformeId){
  const setor = document.getElementById(selectSetorId).value;
  const uniformeSelect = document.getElementById(selectUniformeId);

  uniformeSelect.innerHTML = '';

  (uniformesPorSetor[setor] || []).forEach(item => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    uniformeSelect.appendChild(option);
  });
}

document.getElementById('setorMov').addEventListener('change', () => {
  atualizarUniformes('setorMov', 'uniformeMov');
});

document.getElementById('setorLavanderia').addEventListener('change', () => {
  atualizarUniformes('setorLavanderia', 'uniformeLavanderia');
});
